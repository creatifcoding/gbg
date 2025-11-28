import React from "react"

import { useState, useEffect, useRef, useId } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface AnimatedExpandableCardProps {
  title: React.ReactNode
  children: React.ReactNode
  defaultExpanded?: boolean
}

export function AnimatedExpandableCard({ title, children, defaultExpanded = false }: AnimatedExpandableCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const cardRef = useRef<HTMLDivElement>(null)
  const contentId = useId()

  const toggleExpand = () => {
    setIsExpanded((prev) => !prev)
  }

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExpanded(false)
      }
    }

    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("keydown", handleEscape)
    }
  }, [])

  const renderStaggeredChildren = () => {
    return React.Children.map(children, (child, index) => {
      if (React.isValidElement(child)) {
        return React.cloneElement(child as React.ReactElement<any>, {
          className: cn(
            child.props.className,
            "transition-all duration-500",
            isExpanded ? "opacity-100 translate-y-0 scale-100 blur-0" : "opacity-0 -translate-y-2 scale-95 blur-sm",
          ),
          style: {
            ...child.props.style,
            transitionDelay: isExpanded ? `${index * 50}ms` : "0ms",
          },
        })
      }
      return child
    })
  }

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative w-full max-w-[600px] rounded-xl border border-[rgba(147,51,234,0.3)] bg-[rgba(255,255,255,0.02)] backdrop-blur-[10px] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] will-change-[height] contain-[layout_style_paint]",
        isExpanded ? "h-auto" : "h-[60px]",
        "animate-pulsing-glow",
      )}
    >
      <div className="relative h-[60px] flex items-center px-6">
        <div className="font-medium text-gray-800 dark:text-gray-200">{title}</div>
        <button
          onClick={toggleExpand}
          aria-expanded={isExpanded}
          aria-controls={contentId}
          className="absolute top-[18px] right-4 w-6 h-6 flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 animate-flash"
        >
          <ChevronDown
            className={cn(
              "w-5 h-5 text-purple-400 transition-transform duration-500 ease-[cubic-bezier(0.68,-0.55,0.265,1.55)] will-change-transform",
              isExpanded && "rotate-180",
            )}
          />
        </button>
      </div>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div id={contentId} className="px-6 pb-4 space-y-4">
            {renderStaggeredChildren()}
          </div>
        </div>
      </div>
    </div>
  )
}