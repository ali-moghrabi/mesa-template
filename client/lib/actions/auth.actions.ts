import axios from "axios";
import {
  LoginUserForm,
  LoginUserSchema,
  RegisterUserForm,
  RegisterUserSchema,
} from "../schemas";
import ServerEndpoint from "../server-endpoint";

export async function registerUser(data: RegisterUserForm) {
  try {
    const parsedData = RegisterUserSchema.parse(data);

    const response = await ServerEndpoint.post("/auth/register", parsedData, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.status !== 201) {
      throw new Error(response.data.message || "Something went wrong");
    }
  } catch (error) {
    console.error(error);
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data.message || "Something went wrong");
    } else if (error instanceof Error) {
      throw new Error("Something went wrong");
    }
  }
}

export async function loginUser(data: LoginUserForm) {
  try {
    const parsedData = LoginUserSchema.parse(data);

    const response = await ServerEndpoint.post("/auth/login", parsedData, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.status !== 201) {
      throw new Error(response.data.message || "Something went wrong");
    }
  } catch (error) {
    console.error(error);
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data.message || "Something went wrong");
    } else if (error instanceof Error) {
      throw new Error("Something went wrong");
    }
  }
}

export async function logoutUser() {
  try {
    const response = await ServerEndpoint.post("/auth/logout");

    if (response.status !== 200) {
      throw new Error(response.data.message || "Something went wrong");
    }
  } catch (error) {
    console.error(error);
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data.message || "Something went wrong");
    } else if (error instanceof Error) {
      throw new Error("Something went wrong");
    }
  }
}
