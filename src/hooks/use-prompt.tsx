import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";

const PromptDialogComponent = ({
    promise,
    handleClose,
    title,
    message
}: {
    promise: { resolve: (value: string | null) => void } | null,
    handleClose: () => void,
    title: string,
    message: string
}) => {
    const [value, setValue] = useState("");

    const handleCancel = () => {
        promise?.resolve(null);
        handleClose();
    };

    const handleConfirm = (e?: React.FormEvent) => {
        e?.preventDefault();
        promise?.resolve(value);
        handleClose();
    };

    return (
        <Dialog open={promise !== null} onOpenChange={(open) => {
            if (!open) handleCancel();
            if (open) setValue("");
        }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{message}</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleConfirm} className="space-y-4 pt-2">
                    <Input
                        autoFocus
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="Project name"
                        required
                    />
                    <DialogFooter>
                        <Button type="button" onClick={handleCancel} variant="outline">
                            Cancel
                        </Button>
                        <Button type="submit">
                            Continue
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export const usePrompt = (
    title: string,
    message: string,
): [() => JSX.Element, () => Promise<string | null>] => {
    const [promise, setPromise] = useState<{ resolve: (value: string | null) => void } | null>(null);

    const prompt = () => new Promise<string | null>((resolve) => {
        setPromise({ resolve });
    });

    const handleClose = () => {
        setPromise(null);
    };

    const PromptDialog = () => (
        <PromptDialogComponent
            promise={promise}
            handleClose={handleClose}
            title={title}
            message={message}
        />
    );

    return [PromptDialog, prompt];
};
