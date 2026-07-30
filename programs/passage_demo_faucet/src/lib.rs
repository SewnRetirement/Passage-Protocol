//! Passage Demo Faucet — devnet only.
//!
//! Lets anyone try the protocol without asking us for tokens first. A single
//! `claim` gives the caller a Passage credential (so the transfer hook will let
//! them receive pTokens) and mints them some test tUSDY to wrap.
//!
//! This exists so the public demo is actually usable. On mainnet credentials
//! come from a real KYC provider, not from a permissionless faucet — the
//! registry authority is simply handed to whoever does that verification.

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, MintTo, TokenAccount, TokenInterface};

declare_id!("7e2xLqS525PMSrr1Wx6zqamcHCUvsaS3bGCZVmPA49XR");

/// Config account for the faucet.
pub const FAUCET_SEED: &[u8] = b"faucet";
/// Signing PDA. Deliberately kept system-owned and data-less so it can pay rent
/// for the credential accounts it creates — a program-owned account cannot be a
/// payer in a system-program CreateAccount.
pub const SIGNER_SEED: &[u8] = b"faucet-signer";

/// Ceiling on a single drip, so a misconfigured faucet can't mint absurd amounts.
pub const MAX_DRIP: u64 = 10_000_000_000; // 10,000 tokens at 6 decimals

#[program]
pub mod passage_demo_faucet {
    use super::*;

    /// Set up the faucet for one test mint. The caller stays admin so the drip
    /// size can be tuned later.
    pub fn initialize(ctx: Context<Initialize>, drip_amount: u64) -> Result<()> {
        require!(drip_amount > 0 && drip_amount <= MAX_DRIP, FaucetError::InvalidDripAmount);

        let faucet = &mut ctx.accounts.faucet;
        faucet.admin = ctx.accounts.admin.key();
        faucet.asset_mint = ctx.accounts.asset_mint.key();
        faucet.drip_amount = drip_amount;
        faucet.bump = ctx.bumps.faucet;
        faucet.signer_bump = ctx.bumps.faucet_signer;
        Ok(())
    }

    /// Change the drip size (admin only).
    pub fn set_drip_amount(ctx: Context<SetDripAmount>, drip_amount: u64) -> Result<()> {
        require!(drip_amount > 0 && drip_amount <= MAX_DRIP, FaucetError::InvalidDripAmount);
        ctx.accounts.faucet.drip_amount = drip_amount;
        Ok(())
    }

    /// Hand the identity registry on to someone else (admin only).
    /// Without this the registry would be stuck with the faucet as its
    /// authority forever, since only this program can sign for that PDA.
    pub fn set_identity_authority(
        ctx: Context<SetIdentityAuthority>,
        new_authority: Pubkey,
    ) -> Result<()> {
        let signer_seeds: &[&[&[u8]]] =
            &[&[SIGNER_SEED, &[ctx.accounts.faucet.signer_bump]]];
        passage_identity::cpi::set_authority(
            CpiContext::new_with_signer(
                ctx.accounts.identity_program.to_account_info(),
                passage_identity::cpi::accounts::SetAuthority {
                    config: ctx.accounts.identity_config.to_account_info(),
                    authority: ctx.accounts.faucet_signer.to_account_info(),
                },
                signer_seeds,
            ),
            new_authority,
        )
    }

    /// Verify the caller (if they aren't already) and mint them test tokens.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let signer_seeds: &[&[&[u8]]] =
            &[&[SIGNER_SEED, &[ctx.accounts.faucet.signer_bump]]];

        // Only issue a credential if they don't have one — verify_wallet uses
        // `init`, so calling it twice would fail on an already-verified wallet.
        if ctx.accounts.credential.data_is_empty() {
            passage_identity::cpi::verify_wallet(
                CpiContext::new_with_signer(
                    ctx.accounts.identity_program.to_account_info(),
                    passage_identity::cpi::accounts::VerifyWallet {
                        config: ctx.accounts.identity_config.to_account_info(),
                        credential: ctx.accounts.credential.to_account_info(),
                        authority: ctx.accounts.faucet_signer.to_account_info(),
                        system_program: ctx.accounts.system_program.to_account_info(),
                    },
                    signer_seeds,
                ),
                ctx.accounts.user.key(),
            )?;
        }

        let amount = ctx.accounts.faucet.drip_amount;
        token_interface::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.asset_mint.to_account_info(),
                    to: ctx.accounts.user_asset_account.to_account_info(),
                    authority: ctx.accounts.faucet_signer.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        emit!(Claimed { user: ctx.accounts.user.key(), amount });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + Faucet::INIT_SPACE,
        seeds = [FAUCET_SEED],
        bump
    )]
    pub faucet: Account<'info, Faucet>,
    /// CHECK: signing PDA; stays system-owned so it can pay credential rent
    #[account(seeds = [SIGNER_SEED], bump)]
    pub faucet_signer: UncheckedAccount<'info>,
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetDripAmount<'info> {
    #[account(mut, seeds = [FAUCET_SEED], bump = faucet.bump, has_one = admin)]
    pub faucet: Account<'info, Faucet>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct SetIdentityAuthority<'info> {
    #[account(seeds = [FAUCET_SEED], bump = faucet.bump, has_one = admin)]
    pub faucet: Account<'info, Faucet>,
    /// CHECK: signing PDA that currently holds the registry authority
    #[account(seeds = [SIGNER_SEED], bump = faucet.signer_bump)]
    pub faucet_signer: UncheckedAccount<'info>,
    /// CHECK: identity registry config; validated by the identity program
    #[account(mut)]
    pub identity_config: UncheckedAccount<'info>,
    /// CHECK: the identity program
    #[account(address = passage_identity::ID)]
    pub identity_program: UncheckedAccount<'info>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(seeds = [FAUCET_SEED], bump = faucet.bump, has_one = asset_mint)]
    pub faucet: Account<'info, Faucet>,
    /// CHECK: signing PDA; holds the SOL that pays for new credentials
    #[account(mut, seeds = [SIGNER_SEED], bump = faucet.signer_bump)]
    pub faucet_signer: UncheckedAccount<'info>,

    /// CHECK: identity registry config; validated by the identity program
    #[account(mut)]
    pub identity_config: UncheckedAccount<'info>,
    /// CHECK: credential PDA for `user`; created by the identity program if absent
    #[account(mut)]
    pub credential: UncheckedAccount<'info>,
    /// CHECK: the identity program
    #[account(address = passage_identity::ID)]
    pub identity_program: UncheckedAccount<'info>,

    #[account(mut)]
    pub asset_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, token::mint = asset_mint, token::authority = user)]
    pub user_asset_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Faucet {
    pub admin: Pubkey,
    pub asset_mint: Pubkey,
    pub drip_amount: u64,
    pub bump: u8,
    pub signer_bump: u8,
}

#[event]
pub struct Claimed {
    pub user: Pubkey,
    pub amount: u64,
}

#[error_code]
pub enum FaucetError {
    #[msg("Drip amount must be greater than 0 and at most MAX_DRIP")]
    InvalidDripAmount,
}
