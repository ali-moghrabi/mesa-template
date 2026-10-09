interface IUser {
  _id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  isEmailVerified: boolean;
  role: "customer" | "staff" | "manager" | "admin";
  createdAt: Date;
  updatedAt: Date;
}
