"use client";

import {
  AnimatePresence,
  motion,
  type HTMLMotionProps,
  type Transition,
  type Variants,
} from "framer-motion";
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

type MorphingDialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  layoutId: string;
  transition: Transition;
};

const DEFAULT_TRANSITION: Transition = {
  duration: 0.3,
  ease: "easeInOut",
};

const MorphingDialogContext = createContext<MorphingDialogContextValue | null>(null);

function useMorphingDialog() {
  const context = useContext(MorphingDialogContext);
  if (!context) {
    throw new Error("MorphingDialog components must be used inside MorphingDialog.");
  }
  return context;
}

export function MorphingDialog({
  children,
  transition = DEFAULT_TRANSITION,
}: {
  children: React.ReactNode;
  transition?: Transition;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      layoutId: `morphing-dialog-${id}`,
      transition,
    }),
    [id, open, transition]
  );

  return <MorphingDialogContext.Provider value={value}>{children}</MorphingDialogContext.Provider>;
}

export function MorphingDialogTrigger({ children }: { children: React.ReactNode }) {
  const { setOpen } = useMorphingDialog();

  if (!isValidElement<{ onClick?: (event: React.MouseEvent) => void }>(children)) {
    return null;
  }

  return cloneElement(children, {
    onClick: (event: React.MouseEvent) => {
      children.props.onClick?.(event);
      setOpen(true);
    },
  });
}

export function MorphingDialogContainer({ children }: { children: React.ReactNode }) {
  const { open, setOpen, transition } = useMorphingDialog();

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
          className="fixed inset-0 z-[100]"
        >
          <button
            type="button"
            aria-label="Close image viewer"
            className="absolute inset-0 bg-black/82 backdrop-blur-md"
            onClick={() => setOpen(false)}
          />
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function MorphingDialogContent({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="pointer-events-none fixed inset-0 flex items-center justify-center p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className={`pointer-events-auto ${className}`}
      >
        {children}
      </motion.div>
    </div>
  );
}

export function MorphingDialogClose({
  children,
  className = "",
  variants,
}: {
  children: React.ReactNode;
  className?: string;
  variants?: Variants;
}) {
  const { setOpen, transition } = useMorphingDialog();

  return (
    <motion.button
      type="button"
      onClick={() => setOpen(false)}
      className={className}
      variants={variants}
      initial={variants ? "initial" : undefined}
      animate={variants ? "animate" : undefined}
      exit={variants ? "exit" : undefined}
      transition={variants ? undefined : transition}
    >
      {children}
    </motion.button>
  );
}

export function MorphingDialogImage({
  src,
  alt,
  className = "",
  ...props
}: HTMLMotionProps<"img"> & {
  src: string;
  alt: string;
}) {
  const { layoutId, transition } = useMorphingDialog();

  return (
    <motion.img
      layoutId={layoutId}
      src={src}
      alt={alt}
      className={className}
      transition={transition}
      {...props}
    />
  );
}
