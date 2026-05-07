export type OnboardingSubmitRequest = {
  driverId: string;
  form: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    trn: string;
    nis: string;
    licenceNumber: string;
    licenceExpiry: string;
    badgeNumber: string;
    plateNumber: string;
    vehicleMake: string;
    vehicleModel: string;
    vehicleYear: string;
    franchiseNumber: string;
    franchiseExpiry: string;
  };
  uploadedDocs: Array<{
    id: string;
    fileName: string;
    filePath?: string;
  }>;
};

export type AdminDecisionRequest = {
  driverId: string;
  adminNote: string;
  docs: Array<{
    id: string;
    status: "approved" | "pending" | "rejected" | "resubmit";
    note: string;
  }>;
  activateDriver: boolean;
};
