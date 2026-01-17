/** @jsxImportSource @opentui/react */
/**
 * Input Primitive
 *
 * Styled wrapper around OpenTUI's `<input>` component.
 */
import type { ReactNode } from "react"

export interface InputProps {
  placeholder?: string
  value?: string
  focused?: boolean
  onInput?: (value: string) => void
  onChange?: (value: string) => void
  onSubmit?: (value: string) => void
}

export const Input = ({
  placeholder,
  focused = false,
  onInput,
  onChange,
  onSubmit,
}: InputProps): ReactNode => {
  return (
    <input
      placeholder={placeholder}
      focused={focused}
      onInput={onInput}
      onChange={onChange}
      onSubmit={onSubmit}
      style={{ focusedBackgroundColor: "#333333" }}
    />
  )
}

export interface TextAreaProps {
  placeholder?: string
  focused?: boolean
}

export const TextArea = ({ placeholder, focused = false }: TextAreaProps): ReactNode => {
  return <textarea placeholder={placeholder} focused={focused} />
}
