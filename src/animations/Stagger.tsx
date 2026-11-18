import { Children, type ReactElement, type ReactNode } from "react";
import { motion } from "framer-motion";
import { staggerContainer, fadeInUp } from "./variants";

interface StaggerProps {
  children: ReactNode;
  className?: string;
}

/** Frame a page root: staggers each top-level child in with a fade + rise. */
export const Stagger = ({ children, className }: StaggerProps) => {
  const items = Children.toArray(children);
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {items.map((child, i) => (
        <motion.div
          key={(child as ReactElement).key ?? i}
          variants={fadeInUp}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
};