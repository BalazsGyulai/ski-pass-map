/** Stub for future Google rewarded inventory. No third-party code until enabled in config. */

export interface RewardedAdsProvider {
  isReady(): boolean;
  showRewarded(): Promise<boolean>;
}

export const stubRewardedAds: RewardedAdsProvider = {
  isReady() {
    return false;
  },
  async showRewarded() {
    return false;
  },
};
