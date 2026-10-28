import { Toaster as Sonner, toast } from "sonner"

const isMobile = () => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches

const Toaster = ({ ...props }) => {
  return (
    <Sonner
      theme="light"
      position={isMobile() ? "top-center" : "top-right"}
      offset={isMobile() ? 12 : 20}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-800 group-[.toaster]:border-slate-200 group-[.toaster]:shadow-md group-[.toaster]:rounded-lg",
          description: "group-[.toast]:text-slate-500",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props} />
  );
}

export { Toaster, toast }
