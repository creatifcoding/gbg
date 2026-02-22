/**
 * Code editor open state — single atom, zero dependencies.
 * Import this from anywhere without circular dep risk.
 */
import { Atom } from '@effect-atom/atom'

export const codeEditorOpenAtom = Atom.make<boolean>(false)
