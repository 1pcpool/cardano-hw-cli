import * as InteropLib from 'cardano-hw-interop-lib'
import { Errors } from '../errors'
import { partition } from '../util'
import {
  ParsedTransactionValidateRawArguments,
  ParsedTransactionValidateArguments,
  ParsedTransactionTransformRawArguments,
  ParsedTransactionTransformArguments,
  CborHex,
} from '../types'
import { constructRawTxOutput, constructTxOutput, write } from '../fileWriter'
import { containsVKeyWitnesses } from './transaction'

const printValidationErrors = (
  cborHex: CborHex,
  validator: (txCbor: Buffer) => InteropLib.ValidationError[],
  printSuccessMessage: boolean,
): { containsUnfixable: boolean, containsFixable: boolean } => {
  const cbor = Buffer.from(cborHex, 'hex')
  const validationErrors = validator(cbor)
  const [fixableErrors, unfixableErrors] = partition(validationErrors, (e) => e.fixable)
  const errorGroups = [
    { title: 'unfixable', errors: unfixableErrors },
    { title: 'fixable', errors: fixableErrors },
  ]
  errorGroups.forEach(({ title, errors }) => {
    if (errors.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`The transaction contains following ${title} errors:`)
      // eslint-disable-next-line no-console
      errors.forEach((e) => console.log(`- ${e.reason} (${e.position})`))
    }
  })

  if (validationErrors.length === 0 && printSuccessMessage) {
    // eslint-disable-next-line no-console
    console.log('The transaction CBOR is valid and canonical.')
  }
  return { containsUnfixable: unfixableErrors.length > 0, containsFixable: fixableErrors.length > 0 }
}

const validateRawTxBeforeSigning = (rawTxCborHex: CborHex): void => {
  const {
    containsUnfixable, containsFixable,
  } = printValidationErrors(rawTxCborHex, InteropLib.validateRawTx, false)

  if (containsUnfixable) {
    throw Error(Errors.TxContainsUnfixableErrors)
  }
  if (containsFixable) {
    throw Error(Errors.TxContainsFixableErrors)
  }
}

const validateRawTx = (args: ParsedTransactionValidateRawArguments) => {
  printValidationErrors(args.rawTxFileData.cborHex, InteropLib.validateRawTx, true)
}

const validateTx = (args: ParsedTransactionValidateArguments) => {
  printValidationErrors(args.txFileData.cborHex, InteropLib.validateTx, true)
}

const transformRawTx = (args: ParsedTransactionTransformRawArguments) => {
  const {
    containsUnfixable, containsFixable,
  } = printValidationErrors(args.rawTxFileData.cborHex, InteropLib.validateRawTx, true)
  if (containsUnfixable) {
    throw Error(Errors.TxContainsUnfixableErrors)
  }
  if (containsFixable) {
    // eslint-disable-next-line no-console
    console.log('Fixed transaction will be written to the output file.')
  }
  const rawTxCbor = Buffer.from(args.rawTxFileData.cborHex, 'hex')
  const transformedRawTx = InteropLib.transformRawTx(InteropLib.parseRawTx(rawTxCbor))
  const encodedRawTx = InteropLib.encodeRawTx(transformedRawTx).toString('hex') as CborHex
  write(args.outFile, constructRawTxOutput(args.rawTxFileData.era, encodedRawTx))
}

const transformTx = (args: ParsedTransactionTransformArguments) => {
  const {
    containsUnfixable, containsFixable,
  } = printValidationErrors(args.txFileData.cborHex, InteropLib.validateTx, true)
  if (containsUnfixable) {
    throw Error(Errors.TxContainsUnfixableErrors)
  }
  const txCbor = Buffer.from(args.txFileData.cborHex, 'hex')
  const transformedTx = InteropLib.transformTx(InteropLib.parseTx(txCbor))
  if (containsFixable) {
    if (containsVKeyWitnesses(transformedTx)) {
      throw Error(Errors.CannotTransformSignedTx)
    }
    // eslint-disable-next-line no-console
    console.log('Fixed transaction will be written to the output file.')
  }
  const encodedTx = InteropLib.encodeTx(transformedTx).toString('hex') as CborHex
  write(args.outFile, constructTxOutput(args.txFileData.era, encodedTx))
}

export {
  validateRawTxBeforeSigning,
  validateRawTx,
  validateTx,
  transformRawTx,
  transformTx,
}