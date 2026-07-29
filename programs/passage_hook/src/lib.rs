//! Passage Hook — Token-2022 transfer hook.
//!
//! Elke transfer van een pToken triggert dit programma. De hook checkt of de
//! eigenaar van het ontvangende token-account een geldige Credential-PDA heeft
//! in het passage_identity-programma. Zo niet → transfer faalt.
//! Compliance zit hiermee in de token zelf, onafhankelijk van welk protocol
//! de token gebruikt (DEX, lending, wallet-naar-wallet).

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

    /// Maakt de ExtraAccountMetaList-PDA voor een pToken-mint aan.
    /// Definieert welke extra accounts Token-2022 moet meesturen bij Execute:
    ///   5: passage_identity programma (vast adres)
    ///   6: credential-PDA, afgeleid van de owner (offset 32) van het
    ///      ontvangende token-account (account-index 2)
    pub fn initialize_extra_account_meta_list(
        ctx: Context<InitializeExtraAccountMetaList>,
    ) -> Result<()> {
        let metas = vec![
            // index 5: het identity-programma zelf
            ExtraAccountMeta::new_with_pubkey(&passage_identity::ID, false, false)?,
            // index 6: credential PDA van de ontvanger, seeds = ["credential", dest.owner]
            ExtraAccountMeta::new_external_pda_with_seeds(
                5, // index van het identity-programma in de accountlijst
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

    /// Door Token-2022 aangeroepen bij elke transfer.
    pub fn transfer_hook(ctx: Context<TransferHook>, _amount: u64) -> Result<()> {
        let dest_owner = ctx.accounts.destination_token.owner;

        // Credential-account moet bestaan, van het identity-programma zijn
        // en bij de ontvanger horen.
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

    /// Dispatch van de spl-transfer-hook-interface instructies naar Anchor.
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
    /// CHECK: PDA, wordt in de instructie zelf aangemaakt
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
    /// CHECK: owner van het source-account
    pub owner: UncheckedAccount<'info>,
    /// CHECK: de meta-list PDA voor deze mint
    #[account(seeds = [META_LIST_SEED, mint.key().as_ref()], bump)]
    pub extra_account_meta_list: UncheckedAccount<'info>,
    /// CHECK: het passage_identity programma
    #[account(address = passage_identity::ID)]
    pub identity_program: UncheckedAccount<'info>,
    /// CHECK: credential-PDA van de ontvanger; gevalideerd in de instructie
    pub credential: UncheckedAccount<'info>,
}

#[error_code]
pub enum PassageHookError {
    #[msg("Ontvanger is niet geverifieerd (geen geldige Passage-credential)")]
    ReceiverNotVerified,
}
