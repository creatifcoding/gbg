import { Handle, Position, type NodeProps } from "reactflow"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export function CalculatorWidget({ data, id }: NodeProps) {
  const [display, setDisplay] = useState("0")
  const [previousValue, setPreviousValue] = useState<number | null>(null)
  const [operation, setOperation] = useState<string | null>(null)
  const [waitingForOperand, setWaitingForOperand] = useState(false)

  const inputNumber = (num: string) => {
    if (waitingForOperand) {
      setDisplay(num)
      setWaitingForOperand(false)
    } else {
      setDisplay(display === "0" ? num : display + num)
    }
  }

  const inputOperation = (nextOperation: string) => {
    const inputValue = Number.parseFloat(display)

    if (previousValue === null) {
      setPreviousValue(inputValue)
    } else if (operation) {
      const currentValue = previousValue || 0
      const newValue = calculate(currentValue, inputValue, operation)

      setDisplay(String(newValue))
      setPreviousValue(newValue)
    }

    setWaitingForOperand(true)
    setOperation(nextOperation)
  }

  const calculate = (firstValue: number, secondValue: number, operation: string) => {
    switch (operation) {
      case "+":
        return firstValue + secondValue
      case "-":
        return firstValue - secondValue
      case "×":
        return firstValue * secondValue
      case "÷":
        return firstValue / secondValue
      case "=":
        return secondValue
      default:
        return secondValue
    }
  }

  const performCalculation = () => {
    const inputValue = Number.parseFloat(display)

    if (previousValue !== null && operation) {
      const newValue = calculate(previousValue, inputValue, operation)
      setDisplay(String(newValue))
      setPreviousValue(null)
      setOperation(null)
      setWaitingForOperand(true)
    }
  }

  const clear = () => {
    setDisplay("0")
    setPreviousValue(null)
    setOperation(null)
    setWaitingForOperand(false)
  }

  return (
    <div className="bg-gray-900 border border-green-400/30 p-3 min-w-[200px] shadow-lg shadow-green-400/10">
      <Handle type="target" position={Position.Left} className="bg-green-400" />
      <Handle type="source" position={Position.Right} className="bg-green-400" />

      <div className="text-green-400 font-mono text-sm mb-2 flex items-center gap-2">
        <div className="w-2 h-2 bg-green-400 animate-pulse"></div>
        CALC.exe
      </div>

      <div className="bg-black border border-green-400/30 p-2 mb-2">
        <div className="text-green-400 font-mono text-right text-lg">{display}</div>
      </div>

      <div className="grid grid-cols-4 gap-1">
        <Button onClick={clear} className="bg-red-900 hover:bg-red-800 text-red-400 font-mono text-xs">
          C
        </Button>
        <Button
          onClick={() => inputOperation("÷")}
          className="bg-green-900 hover:bg-green-800 text-green-400 font-mono text-xs"
        >
          ÷
        </Button>
        <Button
          onClick={() => inputOperation("×")}
          className="bg-green-900 hover:bg-green-800 text-green-400 font-mono text-xs"
        >
          ×
        </Button>
        <Button
          onClick={() => inputOperation("-")}
          className="bg-green-900 hover:bg-green-800 text-green-400 font-mono text-xs"
        >
          -
        </Button>

        {[7, 8, 9].map((num) => (
          <Button
            key={num}
            onClick={() => inputNumber(String(num))}
            className="bg-gray-800 hover:bg-gray-700 text-green-400 font-mono text-xs"
          >
            {num}
          </Button>
        ))}
        <Button
          onClick={() => inputOperation("+")}
          className="bg-green-900 hover:bg-green-800 text-green-400 font-mono text-xs row-span-2"
        >
          +
        </Button>

        {[4, 5, 6].map((num) => (
          <Button
            key={num}
            onClick={() => inputNumber(String(num))}
            className="bg-gray-800 hover:bg-gray-700 text-green-400 font-mono text-xs"
          >
            {num}
          </Button>
        ))}

        {[1, 2, 3].map((num) => (
          <Button
            key={num}
            onClick={() => inputNumber(String(num))}
            className="bg-gray-800 hover:bg-gray-700 text-green-400 font-mono text-xs"
          >
            {num}
          </Button>
        ))}
        <Button
          onClick={performCalculation}
          className="bg-green-900 hover:bg-green-800 text-green-400 font-mono text-xs row-span-2"
        >
          =
        </Button>

        <Button
          onClick={() => inputNumber("0")}
          className="bg-gray-800 hover:bg-gray-700 text-green-400 font-mono text-xs col-span-2"
        >
          0
        </Button>
        <Button
          onClick={() => inputNumber(".")}
          className="bg-gray-800 hover:bg-gray-700 text-green-400 font-mono text-xs"
        >
          .
        </Button>
      </div>
    </div>
  )
}