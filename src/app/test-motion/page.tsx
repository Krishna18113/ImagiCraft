"use client";

import { AnimatedText } from "@/components/ui/animated-text";
import { useState } from "react";

export default function TestMotionPage() {
    const [key, setKey] = useState(0);

    const handleReplay = () => {
        setKey((prev) => prev + 1);
    };

    return (
        <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-8 font-sans">
            <div className="max-w-2xl w-full bg-neutral-900 border border-neutral-800 p-8 rounded-2xl shadow-2xl">
                <h1 className="text-3xl font-bold text-white mb-6 flex justify-between items-center">
                    <span>Testing Motion</span>
                    <button 
                        onClick={handleReplay}
                        className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-full text-white transition-colors"
                    >
                        Replay Animation
                    </button>
                </h1>
                
                {/* We use key to force unmount and remount so the animation replays */}
                <div key={key}>
                    <AnimatedText 
                        className="text-xl text-neutral-300 leading-relaxed"
                        text="This is a highly robust, physics-based text animation. Watch how each word seamlessly comes into motion, rendering fluidly without jank. This provides the exact premium experience you described from that video!"
                    />
                </div>
            </div>
        </div>
    );
}
