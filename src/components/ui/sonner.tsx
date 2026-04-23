"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-900 group-[.toaster]:border-0 group-[.toaster]:shadow-[0_8px_30px_rgba(0,0,0,0.08)] group-[.toaster]:rounded-[1.5rem] p-4 flex items-start gap-3",
          title: "text-[14px] font-bold tracking-tight",
          description: "text-[12px] text-slate-500 font-medium",
          actionButton:
            "group-[.toast]:bg-slate-900 group-[.toast]:text-white rounded-full font-bold text-xs px-4 py-2",
          cancelButton:
            "group-[.toast]:bg-slate-100 group-[.toast]:text-slate-500 rounded-full font-bold text-xs px-4 py-2",
          icon: "group-data-[type=error]:text-red-500 group-data-[type=success]:text-emerald-500 group-data-[type=warning]:text-amber-500 group-data-[type=info]:text-blue-500 mt-0.5",
        },
      }}
      icons={{
        success: <CircleCheckIcon className="size-5" />,
        info: <InfoIcon className="size-5" />,
        warning: <TriangleAlertIcon className="size-5" />,
        error: <OctagonXIcon className="size-5" />,
        loading: <Loader2Icon className="size-5 animate-spin" />,
      }}
      {...props}
    />
  )
}

export { Toaster }
