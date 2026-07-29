//! Passage Hook — Token-2022 transfer hook.
//!
//! Every pToken transfer triggers this program. The hook checks whether the
//! owner of the receiving token account holds a valid Credential PDA in the
//! passage_identity program. If not, the transfer fails.
//! Compliance lives inside the token itself, regardless of which protocol
//! moves it (DEX, lending, wallet-to-wallet).

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount};
use spl_tlv_account_resolution::{
    account::ExtraAccountMeta, seeds::Seed, state::ExtraAccountMetaList,
};
use spl_transfer_hook_interface::instruction::{ExecuteInstruction, TransferHookInstruction};

declare_id!("2t8mRopezLdyJLDgcD2ufS4LnL1YVeZopzhddwZc13Nf");

pub const META_LIST_SEED: &[u8] = b"extra-account-metas";

#[program]
pub mod passage_hook {
    use super::*;

    /// Creates the ExtraAccountMetaList PDA for a pToken mint.
    /// Defines which extra accounts Token-2022 must pass along on Execute:
    ///   5: the passage_identity program (fixed address)
    ///   6: credential PDA, derived from the owner (offset 32) of the
    ///      receiving token account (account index 2)
    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        let metas = vec![
            // index 5: the identity program itself
            ExtraAccountMeta::new_with_pubkey(&passage_identity::ID, false, false)?,
            // index 6: recipient's credential PDA, seeds = ["credential", dest.owner]
            ExtraAccountMeta::new_external_pda_with_seeds(
                5, // index of the identity program in the account list
                &[
                    Seed::Literal {
                        bytes: passage_identity::CREDENTIAL_SEED.to_vec(),
                    },
                    Seed::AccountData {
                        account_index: 2, // destination token account
                        data_index: 32,   // owner-veld (na mint pubkey)
                        length: 32,
                    },
                ],
                false,
                false,
            )?,
        ];

        let account_size = ExtraAccountMetaList::size_of(metas.len())? as u64;
        let lamports = Rent::get()?.minimum_balance(account_size as usize);

        let mint = ctx.accounts.mint.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            META_LIST_SEED,
            mint.as_ref(),
            &[ctx.bumps.extra_account_meta_list],
        ]];

        anchor_lang::system_program::create_account(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::CreateAccount {
                    from: ctx.accounts.payer.to_account_info(),
                    to: ctx.accounts.extra_account_meta_list.to_account_info(),
                },
            )
            .with_signer(signer_seeds),
            lamports,
            account_size,
            ctx.program_id,
        )?;

        ExtraAccountMetaList::init::<ExecuteInstruction>(
            &mut ctx.accounts.extra_account_meta_list.try_borrow_mut_data()?,
            &metas,
        )?;

        Ok(())
    }

    /// Invoked by Token-2022 on every transfer.
    pub fn transfer_hook(ctx: Context<TransferHook>, _amount: u64) -> Result<()> {
        let dest_owner = ctx.accounts.destination_token.owner;

        // The credential account must exist, be owned by the identity
        // program, and belong to the recipient.
        let cred_info = &ctx.accounts.credential;
        require!(
            cred_info.owner == &passage_identity::ID && !cred_info.data_is_empty(),
            PassageHookError::ReceiverNotVerified
        );

        let data = cred_info.try_borrow_data()?;
        let credential =
            passage_identity::Credential::try_deserialize(&mut data.as_ref())
                .map_err(|_| PassageHookError::ReceiverNotVerified)?;
        require!(
            credential.wallet == dest_owner,
            PassageHookError::ReceiverNotVerified
        );

        Ok(())
    }

    /// Dispatches spl-transfer-hook-interface instructions to Anchor.
    pub fn fallback<'info>(
        program_id: &Pubkey,
        accounts: &'info [AccountInfo<'info>],
        data: &[u8],
    ) -> Result<()> {
        match TransferHookInstruction::unpack(data)
            .map_err(|_| ProgramError::InvalidInstructionData)?
        {
            TransferHookInstruction::Execute { amount } => {
                let amount_bytes = amount.to_le_bytes();
                __private::__global::transfer_hook(program_id, accounts, &amount_bytes)
            }
            _ => Err(ProgramError::InvalidInstructionData.into()),
        }
    }
}

#[derive(Accounts)]
pub struct InitializeExtraAccountMetaList<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: PDA, created inside the instruction itself
    #[account(mut, seeds = [META_LIST_SEED, mint.key().as_ref()], bump)]
    pub extra_account_meta_list: AccountInfo<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferHook<'info> {
    #[account(token::mint = mint)]
    pub source_token: InterfaceAccount<'info, TokenAccount>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(token::mint = mint)]
    pub destination_token: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: owner of the source account
    pub owner: UncheckedAccount<'info>,
    /// CHECK: the meta-list PDA for this mint
    #[account(seeds = [META_LIST_SEED, mint.key().as_ref()], bump)]
    pub extra_account_meta_list: UncheckedAccount<'info>,
    /// CHECK: the passage_identity program
    #[account(address = passage_identity::ID)]
    pub identity_program: UncheckedAccount<'info>,
    /// CHECK: recipient's credential PDA; validated in the instruction
    pub credential: UncheckedAccount<'info>,
}

#[error_code]
pub enum PassageHookError {
    #[msg("Recipient is not verified (no valid Passage credential)")]
    ReceiverNotVerified,
}
