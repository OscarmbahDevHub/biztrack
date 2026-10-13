import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { getToken } from "./api";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import NewSale from "./pages/NewSale";
import Sales from "./pages/Sales";

// Sends you to the login page if you have no token
function RequireLogin({ children }: { children: ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <RequireLogin>
              <Dashboard />
            </RequireLogin>
          }
        />
        <Route
          path="/products"
          element={
            <RequireLogin>
              <Products />
            </RequireLogin>
          }
        />
        <Route
          path="/sales/new"
          element={
            <RequireLogin>
              <NewSale />
            </RequireLogin>
          }
        />
        <Route
          path="/sales"
          element={
            <RequireLogin>
              <Sales />
            </RequireLogin>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}