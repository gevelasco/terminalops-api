export type CompanyDieselPriceSource = 'company' | 'suggested';

export type CompanyDieselPriceSnapshot = {
  enabled: boolean;
  pricePerLiter: number | null;
  suggestedPricePerLiter: number | null;
  source: CompanyDieselPriceSource | null;
  updatedAt: string | null;
};

export type CompanyDieselPriceInput = {
  dieselControlEnabled?: boolean;
  dieselReferencePricePerLiter?: string | null;
  dieselReferencePriceUpdatedAt?: Date | null;
};
