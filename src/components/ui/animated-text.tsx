"use client";

import { motion } from "framer-motion";

interface AnimatedTextProps {
    text: string;
    className?: string;
}

export const AnimatedText = ({ text, className = "" }: AnimatedTextProps) => {
    // Split text into words to animate each word individually, mimicking the AI generating it
    // but with a very fluid, "comes into motion" physical feel.
    const words = text.split(" ");

    const container = {
        hidden: { opacity: 0 },
        visible: (i = 1) => ({
            opacity: 1,
            transition: { staggerChildren: 0.03, delayChildren: 0.02 * i },
        }),
    };

    const child = {
        visible: {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            transition: {
                type: "spring",
                damping: 15,
                stiffness: 150,
            },
        },
        hidden: {
            opacity: 0,
            y: 10,
            filter: "blur(5px)",
            transition: {
                type: "spring",
                damping: 15,
                stiffness: 150,
            },
        },
    };

    return (
        <motion.div
            className={`flex flex-wrap ${className}`}
            style={{ gap: "0.25rem" }} // Small gap between words
            variants={container}
            initial="hidden"
            animate="visible"
        >
            {words.map((word, index) => (
                <motion.span
                    variants={child}
                    key={index}
                    className="inline-block relative"
                >
                    {word}
                </motion.span>
            ))}
        </motion.div>
    );
};
