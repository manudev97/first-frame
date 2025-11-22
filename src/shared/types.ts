export interface IPAsset {
  id: string;
  title: string;
  year?: number;
  ipId: string;
  metadataUri: string;
  posterUrl?: string;
  uploader: string;
  createdAt: string;
  licenseTerms?: LicenseTerms;
}

export interface LicenseTerms {
  commercialUse: boolean;
  commercialRevShare: number;
  derivativesAllowed: boolean;
  derivativesAttribution: boolean;
  mintingFee: string;
}

export interface PuzzleData {
  id: string;
  imageUrl: string;
  difficulty: number;
  parentIpId?: string;
  createdAt: string;
}

export interface User {
  telegramId: number;
  walletAddress?: string;
  registeredIPs: string[];
  completedPuzzles: string[];
  totalRoyalties: string;
}

export interface RoyaltyPayment {
  ipId: string;
  amount: string;
  currency: string;
  timestamp: string;
}

