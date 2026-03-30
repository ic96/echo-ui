"use client";
import {
  motion,
  type Variants,
  type Transition,
  type MotionProps,
} from "framer-motion";

type AnimationPreset =
  | "fadeIn"
  | "fadeUp"
  | "fadeDown"
  | "fadeLeft"
  | "fadeRight"
  | "scale"
  | "none";

const presets: Record<AnimationPreset, Variants> = {
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  fadeUp: {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0 },
  },
  fadeDown: {
    hidden: { opacity: 0, y: -24 },
    visible: { opacity: 1, y: 0 },
  },
  fadeLeft: {
    hidden: { opacity: 0, x: 24 },
    visible: { opacity: 1, x: 0 },
  },
  fadeRight: {
    hidden: { opacity: 0, x: -24 },
    visible: { opacity: 1, x: 0 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
  },
  none: {
    hidden: {},
    visible: {},
  },
};

type AnimatedProps = {
  children: React.ReactNode;
  preset?: AnimationPreset;
  variants?: Variants;
  delay?: number;
  duration?: number;
  transition?: Transition;
  className?: string;
  as?: keyof typeof motion;
} & Omit<MotionProps, "variants" | "transition">;

export function Animated({
  children,
  preset = "fadeUp",
  variants,
  delay = 0,
  duration = 0.5,
  transition,
  className,
  as = "div",
  ...rest
}: AnimatedProps) {
  const Component = motion[as] as typeof motion.div;

  return (
    <Component
      className={className}
      variants={variants ?? presets[preset]}
      initial="hidden"
      animate="visible"
      transition={transition ?? { duration, ease: "easeOut", delay }}
      {...rest}
    >
      {children}
    </Component>
  );
}
