import { Navigate } from "react-router-dom";
import { getValidStoredToken } from "../auth";

export default function ProtectedRoute({ children }) {
  const token = getValidStoredToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
