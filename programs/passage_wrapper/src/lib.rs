//! Passage Wrapper — de kern van Passage Protocol.
//!
//! Gebruikers storten een (permissioned) RWA-token in de vault en ontvangen
//! 1:1 een pToken (Token-2022 met transfer hook). De pToken is DeFi-composable
//! maar beweegt alleen tussen geverifieerde wallets. Wrap/unwrap-fees (bps)
//! blijven in de vault als protocol-omzet en zijn door de authority
//! (straks: de futarchy-treasury) te innen via `collect_fees`.

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    self, Burn, Mint, MintTo, TokenAccount, TokenInterface, TransferChecked,
};

declare_id!("HuM2rUWj5qcuEAWRcGKmpHkh3qwY9Y1m6nsV2UAFxagX");

pub const VAULT_SEED: &[u8] = b"vault";
pub const MAX_FEE_BPS: u16 = 500; // hard cap 5%

#[program]
pub mod passage_wrapper {
    use super::*;

    /// Maak een vault voor een asset. De pToken-mint moet vooraf zijn
    /// aangemaakt met de vault-PDA als mint authority en de Passage
    /// transfer hook als extensie (gebeurt client-side, zie tests).
    pub fn initialize_vault(ctx: Context<InitializeVault>, fee_bps: u16) -> Result<()> {
        require!(fee_bps <= MAX_FEE_BPS, PassageError::FeeTooHigh);

        let vault = &mut ctx.accounts.vault;
        vault.authority = ctx.accounts.authority.key();
        vault.asset_mint = ctx.accounts.asset_mint.key();
        vault.p_mint = ctx.accounts.p_mint.key();
        vault.fee_bps = fee_bps;
        vault.total_wrapped = 0;
        vault.accrued_fees = 0;
        vault.bump = ctx.bumps.vault;

        // pToken-mint moet door de vault gecontroleerd worden
        require!(
            ctx.accounts.p_mint.mint_authority == Some(vault.key()).into(),
            PassageError::InvalidMintAuthority
        );
        require!(
            ctx.accounts.p_mint.decimals == ctx.accounts.asset_mint.decimals,
            PassageError::DecimalsMismatch
        );

        Ok(())
    }

    /// Stort `amount` asset-tokens; ontvang `amount - fee` pTokens.
    pub fn wrap(ctx: Context<Wrap>, amount: u64) -> Result<()> {
        require!(amount > 0, PassageError::ZeroAmount);
        let fee = fee_for(amount, ctx.accounts.vault.fee_bps);
        let net = amount - fee;

        // asset: gebruiker -> vault
        token_interface::transfer_checked(
            CpiContext::new(
                ctx.accounts.asset_token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.user_asset_account.to_account_info(),
                    mint: ctx.accounts.asset_mint.to_account_info(),
                    to: ctx.accounts.vault_asset_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.asset_mint.decimals,
        )?;

        // pToken: mint net bedrag naar gebruiker (vault-PDA tekent)
        let asset_mint = ctx.accounts.vault.asset_mint;
        let signer_seeds: &[&[&[u8]]] =
            &[&[VAULT_SEED, asset_mint.as_ref(), &[ctx.accounts.vault.bump]]];
        token_interface::mint_to(
            CpiContext::new(
                ctx.accounts.p_token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.p_mint.to_account_info(),
                    to: ctx.accounts.user_p_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            net,
        )?;

        let vault = &mut ctx.accounts.vault;
        vault.total_wrapped = vault.total_wrapped.checked_add(net).unwrap();
        vault.accrued_fees = vault.accrued_fees.checked_add(fee).unwrap();

        emit!(Wrapped {
            user: ctx.accounts.user.key(),
            amount,
            fee
        });
        Ok(())
    }

    /// Burn `amount` pTokens; ontvang `amount - fee` asset-tokens terug.
    pub fn unwrap(ctx: Context<Unwrap>, amount: u64) -> Result<()> {
        require!(amount > 0, PassageError::ZeroAmount);
        let fee = fee_for(amount, ctx.accounts.vault.fee_bps);
        let net = amount - fee;

        // pToken burnen
        token_interface::burn(
            CpiContext::new(
                ctx.accounts.p_token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.p_mint.to_account_info(),
                    from: ctx.accounts.user_p_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        // asset terug naar gebruiker (vault-PDA tekent)
        let asset_mint = ctx.accounts.vault.asset_mint;
        let signer_seeds: &[&[&[u8]]] =
            &[&[VAULT_SEED, asset_mint.as_ref(), &[ctx.accounts.vault.bump]]];
        token_interface::transfer_checked(
            CpiContext::new(
                ctx.accounts.asset_token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault_asset_account.to_account_info(),
                    mint: ctx.accounts.asset_mint.to_account_info(),
                    to: ctx.accounts.user_asset_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            net,
            ctx.accounts.asset_mint.decimals,
        )?;

        let vault = &mut ctx.accounts.vault;
        vault.total_wrapped = vault.total_wrapped.checked_sub(amount).unwrap();
        vault.accrued_fees = vault.accrued_fees.checked_add(fee).unwrap();

        emit!(Unwrapped {
            user: ctx.accounts.user.key(),
            amount,
            fee
        });
        Ok(())
    }

    /// Stuur opgebouwde fees (in de onderliggende asset) naar de treasury.
    pub fn collect_fees(ctx: Context<CollectFees>) -> Result<()> {
        let fees = ctx.accounts.vault.accrued_fees;
        require!(fees > 0, PassageError::NothingToCollect);

        let asset_mint = ctx.accounts.vault.asset_mint;
        let signer_seeds: &[&[&[u8]]] =
            &[&[VAULT_SEED, asset_mint.as_ref(), &[ctx.accounts.vault.bump]]];
        token_interface::transfer_checked(
            CpiContext::new(
                ctx.accounts.asset_token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.vault_asset_account.to_account_info(),
                    mint: ctx.accounts.asset_mint.to_account_info(),
                    to: ctx.accounts.treasury_asset_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            fees,
            ctx.accounts.asset_mint.decimals,
        )?;

        ctx.accounts.vault.accrued_fees = 0;
        emit!(FeesCollected { amount: fees });
        Ok(())
    }
}

fn fee_for(amount: u64, fee_bps: u16) -> u64 {
    ((amount as u128) * (fee_bps as u128) / 10_000) as u64
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Vault::INIT_SPACE,
        seeds = [VAULT_SEED, asset_mint.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    pub asset_mint: InterfaceAccount<'info, Mint>,
    pub p_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = asset_mint,
        associated_token::authority = vault,
        associated_token::token_program = asset_token_program,
    )]
    pub vault_asset_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub asset_token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Wrap<'info> {
    #[account(
        mut,
        seeds = [VAULT_SEED, vault.asset_mint.as_ref()],
        bump = vault.bump,
        has_one = asset_mint,
        has_one = p_mint,
    )]
    pub vault: Account<'info, Vault>,
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub p_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, token::mint = asset_mint, token::authority = user)]
    pub user_asset_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = asset_mint,
        associated_token::authority = vault,
        associated_token::token_program = asset_token_program,
    )]
    pub vault_asset_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = p_mint, token::authority = user)]
    pub user_p_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub asset_token_program: Interface<'info, TokenInterface>,
    pub p_token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct Unwrap<'info> {
    #[account(
        mut,
        seeds = [VAULT_SEED, vault.asset_mint.as_ref()],
        bump = vault.bump,
        has_one = asset_mint,
        has_one = p_mint,
    )]
    pub vault: Account<'info, Vault>,
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub p_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, token::mint = asset_mint, token::authority = user)]
    pub user_asset_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = asset_mint,
        associated_token::authority = vault,
        associated_token::token_program = asset_token_program,
    )]
    pub vault_asset_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = p_mint, token::authority = user)]
    pub user_p_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub asset_token_program: Interface<'info, TokenInterface>,
    pub p_token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct CollectFees<'info> {
    #[account(
        mut,
        seeds = [VAULT_SEED, vault.asset_mint.as_ref()],
        bump = vault.bump,
        has_one = asset_mint,
        has_one = authority,
    )]
    pub vault: Account<'info, Vault>,
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = asset_mint,
        associated_token::authority = vault,
        associated_token::token_program = asset_token_program,
    )]
    pub vault_asset_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = asset_mint)]
    pub treasury_asset_account: InterfaceAccount<'info, TokenAccount>,
    pub authority: Signer<'info>,
    pub asset_token_program: Interface<'info, TokenInterface>,
}

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub authority: Pubkey,
    pub asset_mint: Pubkey,
    pub p_mint: Pubkey,
    pub fee_bps: u16,
    pub total_wrapped: u64,
    pub accrued_fees: u64,
    pub bump: u8,
}

#[event]
pub struct Wrapped {
    pub user: Pubkey,
    pub amount: u64,
    pub fee: u64,
}

#[event]
pub struct Unwrapped {
    pub user: Pubkey,
    pub amount: u64,
    pub fee: u64,
}

#[event]
pub struct FeesCollected {
    pub amount: u64,
}

#[error_code]
pub enum PassageError {
    #[msg("Fee te hoog (max 500 bps)")]
    FeeTooHigh,
    #[msg("pToken mint authority moet de vault-PDA zijn")]
    InvalidMintAuthority,
    #[msg("Decimals van pToken en asset komen niet overeen")]
    DecimalsMismatch,
    #[msg("Bedrag moet groter dan 0 zijn")]
    ZeroAmount,
    #[msg("Geen fees om te innen")]
    NothingToCollect,
}
