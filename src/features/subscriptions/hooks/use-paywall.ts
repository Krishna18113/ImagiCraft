import { useSubscriptionModal } from "@/features/subscriptions/store/use-subscription-modal";
import { useGetSubscription } from "@/features/subscriptions/api/use-get-subscription";

export const usePaywall = () => {
  return {
    isLoading: false,
    shouldBlock: false,
    triggerPaywall: () => {},
  };
};
