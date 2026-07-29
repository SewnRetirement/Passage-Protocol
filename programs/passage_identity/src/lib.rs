//! Passage Identity — on-chain registry van geverifieerde wallets.
//!
//! Een off-chain KYC-provider (bijv. Civic/Sumsub) verifieert een gebruiker;
//! de registry-authority schrijft daarna een Credential-PDA voor die wallet.
//! Het transfer-hook-programma leest deze PDA om transfers te gaten.

use anchor_lang::prelude::*;

declare_id!("8ueut8DShZXteSLKq4VbQtWyw5eXGNS1efUxyKNKGpup");

pub const CONFIG_SEED: &[u8] = b"config";
pub const CREDENTIAL_SEED: &[u8] = b"credential";

#[program]
pub mod passage_identity {
    use super::*;

    /// Init registry; `authority` mag credentials uitgeven/intrekken.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.bump = ctx.bumps.config;
        Ok(())
    }

    /// Geef een credential uit aan `wallet` (alleen authority).
    pub fn verify_wallet(ctx: Context<VerifyWallet>, wallet: Pubkey) -> Result<()> {
        let cred = &mut ctx.accounts.credential;
        cred.wallet = wallet;
        cred.issued_at = Clock::get()?.unix_timestamp;
        cred.bump = ctx.bumps.credential;
        emit!(WalletVerified { wallet });
        Ok(())
    }

    /// Trek een credential in (alleen authority). Sluit de PDA.
    pub fn revoke_wallet(ctx: Context<RevokeWallet>, wallet: Pubkey) -> Result<()> {
        emit!(WalletRevoked { wallet });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(wallet: Pubkey)]
pub struct VerifyWallet<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority)]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = authority,
        space = 8 + Credential::INIT_SPACE,
        seeds = [CREDENTIAL_SEED, wallet.as_ref()],
        bump
    )]
    pub credential: Account<'info, Credential>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(wallet: Pubkey)]
pub struct RevokeWallet<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump, has_one = authority)]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        close = authority,
        seeds = [CREDENTIAL_SEED, wallet.as_ref()],
        bump = credential.bump
    )]
    pub credential: Account<'info, Credential>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub authority: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Credential {
    pub wallet: Pubkey,
    pub issued_at: i64,
    pub bump: u8,
}

#[event]
pub struct WalletVerified {
    pub wallet: Pubkey,
}

#[event]
pub struct WalletRevoked {
    pub wallet: Pubkey,
}
