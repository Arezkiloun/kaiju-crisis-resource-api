export interface CreateTransferDto {
  sourceDistrictCode: string;
  destinationDistrictCode: string;
  resourceTypeId: number;
  quantity: number;
}

export interface CreateTransitDto {
  sourceDistrictCode: string;
  transitDistrictCode: string;
  destinationDistrictCode: string;
  resourceTypeId: number;
  quantity: number;
}

export interface CreateMaritimeDto {
  sourceDistrictCode: string;
  destinationDistrictCode: string;
  resourceTypeId: number;
  quantity: number;
}

export interface CreateRequisitionDto {
  sourceDistrictCode: string;
  destinationDistrictCode: string;
  resourceTypeId: number;
  quantity: number;
}
