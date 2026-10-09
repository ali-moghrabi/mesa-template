import axios from "axios";

const ServerEndpoint = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
});

ServerEndpoint.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      if (error.code === "ECONNABORTED") {
        console.error("Request timed out.");
        Promise.reject(error);
        throw new Error("The request took too long. Please try again.");
      }
    }

    return Promise.reject(error);
  },
);

export default ServerEndpoint;
