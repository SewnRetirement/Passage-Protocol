//! Passage Pool — a gated constant-product AMM for pTokens.
//!
//! Swaps a pToken (Token-2022 with the Passage transfer hook) against a quote
//! asset (e.g. USDC). Because the pToken carries its compliance in the token
//! itself, the pool PDA simply needs a credential in the identity registry —
//! after that, the pool is a normal AMM while every participant stays verified.
//!
//! MVP scope: x*y=k, 25 bps swap fee that accrues to LPs, classic LP mint.
//! pToken CPIs use `onchain::invoke_transfer_checked`, which resolves the
//! transfer-hook extra accounts on-chain (pass them as remaining accounts).

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint as SplMint, MintTo, Token, TokenAccount as SplTokenAccount};
use anchor_spl::token_2022::spl_token_2022;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

declare_id!("2Sj66HHtHt2fkHQkpFSMyf71nZZ7iNELWnJiNHFo33aJ");

pub const POOL_SEED: &[u8] = b"pool";
pub const SWAP_FEE_BPS: u128 = 25; // 0.25%, accrues to LPs

#[program]
pub mod passage_pool {
    use super::*;

    /// Create a pool for pMint/quoteMint. The LP mint is initialized here with
    /// the pool PDA as its authority. NOTE: the pool PDA must be given a
    /// credential in the identity registry before it can receive pTokens.
    pub fn initialize_pool(ctx: Context<InitializePool>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.p_mint = ctx.accounts.p_mint.key();
        pool.quote_mint = ctx.accounts.quote_mint.key();
        pool.lp_mint = ctx.accounts.lp_mint.key();
        pool.bump = ctx.bumps.pool;
        Ok(())
    }

    /// Deposit both assets; receive LP tokens.
    /// First deposit sets the price; later deposits must match the ratio
    /// (amounts are capped by the current ratio; excess quote is not pulled).
    pub fn add_liquidity<'info>(
        ctx: Context<'_, '_, 'info, 'info, ModifyLiquidity<'info>>,
        amount_p: u64,
        max_quote: u64,
    ) -> Result<()> {
        require!(amount_p > 0 && max_quote > 0, PoolError::ZeroAmount);

        let reserve_p = ctx.accounts.pool_p_account.amount as u128;
        let reserve_q = ctx.accounts.pool_quote_account.amount as u128;
        let lp_supply = ctx.accounts.lp_mint.supply as u128;

        let (use_p, use_q, mint_lp) = if lp_supply == 0 {
            let lp = integer_sqrt((amount_p as u128) * (max_quote as u128));
            (amount_p as u128, max_quote as u128, lp)
        } else {
            let need_q = (amount_p as u128) * reserve_q / reserve_p;
            require!(need_q <= max_quote as u128, PoolError::SlippageExceeded);
            let lp = (amount_p as u128) * lp_supply / reserve_p;
            (amount_p as u128, need_q, lp)
        };
        require!(mint_lp > 0, PoolError::ZeroAmount);

        // pToken: user -> pool (transfer hook resolved on-chain)
        transfer_p_token(
            &ctx.accounts.p_token_program.to_account_info(),
            &ctx.accounts.user_p_account.to_account_info(),
            &ctx.accounts.p_mint.to_account_info(),
            &ctx.accounts.pool_p_account.to_account_info(),
            &ctx.accounts.user.to_account_info(),
            ctx.remaining_accounts,
            use_p as u64,
            ctx.accounts.p_mint.decimals,
            None,
        )?;
        // quote: user -> pool
        token::transfer(
            CpiContext::new(
                ctx.accounts.quote_token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.user_quote_account.to_account_info(),
                    to: ctx.accounts.pool_quote_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            use_q as u64,
        )?;
        // LP mint -> user
        let p_mint = ctx.accounts.pool.p_mint;
        let quote_mint = ctx.accounts.pool.quote_mint;
        let seeds: &[&[&[u8]]] = &[&[
            POOL_SEED,
            p_mint.as_ref(),
            quote_mint.as_ref(),
            &[ctx.accounts.pool.bump],
        ]];
        token::mint_to(
            CpiContext::new(
                ctx.accounts.lp_token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.lp_mint.to_account_info(),
                    to: ctx.accounts.user_lp_account.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
            )
            .with_signer(seeds),
            mint_lp as u64,
        )?;

        emit!(LiquidityAdded {
            user: ctx.accounts.user.key(),
            amount_p: use_p as u64,
            amount_quote: use_q as u64,
            lp_minted: mint_lp as u64
        });
        Ok(())
    }

    /// Burn LP tokens; receive the proportional share of both reserves.
    pub fn remove_liquidity<'info>(
        ctx: Context<'_, '_, 'info, 'info, ModifyLiquidity<'info>>,
        lp_amount: u64,
    ) -> Result<()> {
        require!(lp_amount > 0, PoolError::ZeroAmount);
        let reserve_p = ctx.accounts.pool_p_account.amount as u128;
        let reserve_q = ctx.accounts.pool_quote_account.amount as u128;
        let lp_supply = ctx.accounts.lp_mint.supply as u128;
        require!(lp_supply > 0, PoolError::EmptyPool);

        let out_p = (lp_amount as u128) * reserve_p / lp_supply;
        let out_q = (lp_amount as u128) * reserve_q / lp_supply;
        require!(out_p > 0 && out_q > 0, PoolError::ZeroAmount);

        // burn LP
        token::burn(
            CpiContext::new(
                ctx.accounts.lp_token_program.to_account_info(),
                token::Burn {
                    mint: ctx.accounts.lp_mint.to_account_info(),
                    from: ctx.accounts.user_lp_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            lp_amount,
        )?;

        let p_mint = ctx.accounts.pool.p_mint;
        let quote_mint = ctx.accounts.pool.quote_mint;
        let bump = ctx.accounts.pool.bump;
        let seeds: &[&[u8]] = &[POOL_SEED, p_mint.as_ref(), quote_mint.as_ref(), &[bump]];

        // pToken: pool -> user
        transfer_p_token(
            &ctx.accounts.p_token_program.to_account_info(),
            &ctx.accounts.pool_p_account.to_account_info(),
            &ctx.accounts.p_mint.to_account_info(),
            &ctx.accounts.user_p_account.to_account_info(),
            &ctx.accounts.pool.to_account_info(),
            ctx.remaining_accounts,
            out_p as u64,
            ctx.accounts.p_mint.decimals,
            Some(seeds),
        )?;
        // quote: pool -> user
        token::transfer(
            CpiContext::new(
                ctx.accounts.quote_token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.pool_quote_account.to_account_info(),
                    to: ctx.accounts.user_quote_account.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
            )
            .with_signer(&[seeds]),
            out_q as u64,
        )?;

        emit!(LiquidityRemoved {
            user: ctx.accounts.user.key(),
            amount_p: out_p as u64,
            amount_quote: out_q as u64,
            lp_burned: lp_amount
        });
        Ok(())
    }

    /// Swap quote -> pToken (`p_to_quote = false`) or pToken -> quote (`true`).
    /// Constant product with a 25 bps fee on the input, accruing to LPs.
    pub fn swap<'info>(
        ctx: Context<'_, '_, 'info, 'info, Swap<'info>>,
        amount_in: u64,
        min_out: u64,
        p_to_quote: bool,
    ) -> Result<()> {
        require!(amount_in > 0, PoolError::ZeroAmount);
        let reserve_p = ctx.accounts.pool_p_account.amount as u128;
        let reserve_q = ctx.accounts.pool_quote_account.amount as u128;
        require!(reserve_p > 0 && reserve_q > 0, PoolError::EmptyPool);

        let (reserve_in, reserve_out) = if p_to_quote {
            (reserve_p, reserve_q)
        } else {
            (reserve_q, reserve_p)
        };
        let in_after_fee = (amount_in as u128) * (10_000 - SWAP_FEE_BPS) / 10_000;
        let amount_out = reserve_out * in_after_fee / (reserve_in + in_after_fee);
        require!(amount_out >= min_out as u128, PoolError::SlippageExceeded);
        require!(amount_out > 0, PoolError::ZeroAmount);

        let p_mint = ctx.accounts.pool.p_mint;
        let quote_mint = ctx.accounts.pool.quote_mint;
        let bump = ctx.accounts.pool.bump;
        let seeds: &[&[u8]] = &[POOL_SEED, p_mint.as_ref(), quote_mint.as_ref(), &[bump]];

        if p_to_quote {
            // pToken in (user -> pool), quote out (pool -> user)
            transfer_p_token(
                &ctx.accounts.p_token_program.to_account_info(),
                &ctx.accounts.user_p_account.to_account_info(),
                &ctx.accounts.p_mint.to_account_info(),
                &ctx.accounts.pool_p_account.to_account_info(),
                &ctx.accounts.user.to_account_info(),
                ctx.remaining_accounts,
                amount_in,
                ctx.accounts.p_mint.decimals,
                None,
            )?;
            token::transfer(
                CpiContext::new(
                    ctx.accounts.quote_token_program.to_account_info(),
                    token::Transfer {
                        from: ctx.accounts.pool_quote_account.to_account_info(),
                        to: ctx.accounts.user_quote_account.to_account_info(),
                        authority: ctx.accounts.pool.to_account_info(),
                    },
                )
                .with_signer(&[seeds]),
                amount_out as u64,
            )?;
        } else {
            // quote in (user -> pool), pToken out (pool -> user)
            token::transfer(
                CpiContext::new(
                    ctx.accounts.quote_token_program.to_account_info(),
                    token::Transfer {
                        from: ctx.accounts.user_quote_account.to_account_info(),
                        to: ctx.accounts.pool_quote_account.to_account_info(),
                        authority: ctx.accounts.user.to_account_info(),
                    },
                ),
                amount_in,
            )?;
            transfer_p_token(
                &ctx.accounts.p_token_program.to_account_info(),
                &ctx.accounts.pool_p_account.to_account_info(),
                &ctx.accounts.p_mint.to_account_info(),
                &ctx.accounts.user_p_account.to_account_info(),
                &ctx.accounts.pool.to_account_info(),
                ctx.remaining_accounts,
                amount_out as u64,
                ctx.accounts.p_mint.decimals,
                Some(seeds),
            )?;
        }

        emit!(Swapped {
            user: ctx.accounts.user.key(),
            amount_in,
            amount_out: amount_out as u64,
            p_to_quote
        });
        Ok(())
    }
}

/// Token-2022 transfer_checked CPI that resolves transfer-hook extra accounts
/// on-chain. `remaining` must contain: hook program, extra-account-meta-list,
/// identity program, and the destination owner's credential PDA.
#[allow(clippy::too_many_arguments)]
fn transfer_p_token<'info>(
    token_program: &AccountInfo<'info>,
    source: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
    destination: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    remaining: &[AccountInfo<'info>],
    amount: u64,
    decimals: u8,
    signer_seeds: Option<&[&[u8]]>,
) -> Result<()> {
    let seeds: &[&[&[u8]]] = match signer_seeds {
        Some(s) => &[s],
        None => &[],
    };
    spl_token_2022::onchain::invoke_transfer_checked(
        token_program.key,
        source.clone(),
        mint.clone(),
        destination.clone(),
        authority.clone(),
        remaining,
        amount,
        decimals,
        seeds,
    )
    .map_err(Into::into)
}

fn integer_sqrt(v: u128) -> u128 {
    if v == 0 {
        return 0;
    }
    let mut x = v;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + v / x) / 2;
    }
    x
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + Pool::INIT_SPACE,
        seeds = [POOL_SEED, p_mint.key().as_ref(), quote_mint.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, Pool>,
    pub p_mint: InterfaceAccount<'info, Mint>,
    pub quote_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = payer,
        mint::decimals = 6,
        mint::authority = pool,
        mint::token_program = lp_token_program,
    )]
    pub lp_mint: Account<'info, SplMint>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = p_mint,
        associated_token::authority = pool,
        associated_token::token_program = p_token_program,
    )]
    pub pool_p_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = quote_mint,
        associated_token::authority = pool,
        associated_token::token_program = quote_token_program,
    )]
    pub pool_quote_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub p_token_program: Interface<'info, TokenInterface>,
    pub quote_token_program: Interface<'info, TokenInterface>,
    pub lp_token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ModifyLiquidity<'info> {
    #[account(
        mut,
        seeds = [POOL_SEED, pool.p_mint.as_ref(), pool.quote_mint.as_ref()],
        bump = pool.bump,
        has_one = p_mint,
        has_one = quote_mint,
        has_one = lp_mint,
    )]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub p_mint: InterfaceAccount<'info, Mint>,
    pub quote_mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub lp_mint: Account<'info, SplMint>,
    #[account(
        mut,
        associated_token::mint = p_mint,
        associated_token::authority = pool,
        associated_token::token_program = p_token_program,
    )]
    pub pool_p_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = quote_mint,
        associated_token::authority = pool,
        associated_token::token_program = quote_token_program,
    )]
    pub pool_quote_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = p_mint, token::authority = user)]
    pub user_p_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = quote_mint, token::authority = user)]
    pub user_quote_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = lp_mint, token::authority = user)]
    pub user_lp_account: Account<'info, SplTokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub p_token_program: Interface<'info, TokenInterface>,
    pub quote_token_program: Interface<'info, TokenInterface>,
    pub lp_token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(
        mut,
        seeds = [POOL_SEED, pool.p_mint.as_ref(), pool.quote_mint.as_ref()],
        bump = pool.bump,
        has_one = p_mint,
        has_one = quote_mint,
    )]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub p_mint: InterfaceAccount<'info, Mint>,
    pub quote_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = p_mint,
        associated_token::authority = pool,
        associated_token::token_program = p_token_program,
    )]
    pub pool_p_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = quote_mint,
        associated_token::authority = pool,
        associated_token::token_program = quote_token_program,
    )]
    pub pool_quote_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = p_mint, token::authority = user)]
    pub user_p_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = quote_mint, token::authority = user)]
    pub user_quote_account: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub p_token_program: Interface<'info, TokenInterface>,
    pub quote_token_program: Interface<'info, TokenInterface>,
}

#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub p_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub lp_mint: Pubkey,
    pub bump: u8,
}

#[event]
pub struct LiquidityAdded {
    pub user: Pubkey,
    pub amount_p: u64,
    pub amount_quote: u64,
    pub lp_minted: u64,
}

#[event]
pub struct LiquidityRemoved {
    pub user: Pubkey,
    pub amount_p: u64,
    pub amount_quote: u64,
    pub lp_burned: u64,
}

#[event]
pub struct Swapped {
    pub user: Pubkey,
    pub amount_in: u64,
    pub amount_out: u64,
    pub p_to_quote: bool,
}

#[error_code]
pub enum PoolError {
    #[msg("Amount must be greater than 0")]
    ZeroAmount,
    #[msg("Pool has no liquidity")]
    EmptyPool,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
}
