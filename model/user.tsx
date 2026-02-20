import { ObjectId } from "mongodb";

interface User {
  _id: ObjectId;
  email: string;
  password: string;
  createdAt: Date;
}

export default User;
