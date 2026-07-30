//! Passage Identity — on-chain registry of verified wallets.
//!
//! An off-chain KYC provider (e.g. Civic/Sumsub) verifies a user; the registry
//! authority then writes a Credential PDA for that wallet. The transfer-hook
//! program reads this PDA to gate transfers.

use anchor_lang::prelude::*;

declare_id!("8ueut8DShZXteSLKq4VbQtWyw5eXGNS1efUxyKNKGpup");

pub const CONFIG_SEED: &[u8] = b"config";
pub const CREDENTIAL_SEED: &[u8] = b"credential";

#[program]
pub mod passage_identity {
    use super::*;

    /// Init the registry; `authority` may issue/revoke credentials.
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.bump = ctx.bumps.config;
        Ok(())
    }

    /// Issue a credential to `wallet` (authority only).
    pub fn verify_wallet(ctx: Context<VerifyWallet>, wallet: Pubkey) -> Result<()> {
        let cred = &mut ctx.accounts.credential;
        cred.wallet = wallet;
        cred.issued_at = Clock::get()?.unix_timestamp;
        cred.bump = ctx.bumps.credential;
        emit!(WalletVerified { wallet });
        Ok(())
    }

    /// Revoke a credential (authority only). Closes the PDA.
    pub fn revoke_wallet(ctx: Context<RevokeWallet>, wallet: Pubkey) -> Result<()> {
        emit!(WalletRevoked { wallet });
        Ok(())
    }

    /// Hand the registry over to a new authority (current authority only).
    /// Lets control move to a KYC issuer, a multisig, or the futarchy treasury
    /// without redeploying the program.
    pub fn set_authority(ctx: Context<SetAuthority>, new_authority: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        let previous = config.authority;
        config.authority = new_authority;
        emit!(AuthorityChanged { previous, current: new_authority });
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

#[derive(Accounts)]
pub struct SetAuthority<'info> {
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = authority)]
    pub config: Account<'info, Config>,
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

#[event]
pub struct AuthorityChanged {
    pub previous: Pubkey,
    pub current: Pubkey,
}
