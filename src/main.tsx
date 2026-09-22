import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import Home from "./pages/Home";
import Campanhas from "./pages/Campanhas";
import Usuarios from "./pages/Usuarios";
import Login from "./pages/Login";
import DefinirSenha from "./pages/DefinirSenha";
import { AuthProvider } from "./lib/auth";
import { Protegido, SomenteAdmin, SomenteCampanhas } from "./components/rotas";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/definir-senha" element={<DefinirSenha />} />
          <Route
            path="/"
            element={
              <Protegido>
                <Home />
              </Protegido>
            }
          />
          <Route
            path="/campanhas"
            element={
              <Protegido>
                <SomenteCampanhas>
                  <Campanhas />
                </SomenteCampanhas>
              </Protegido>
            }
          />
          <Route
            path="/usuarios"
            element={
              <Protegido>
                <SomenteAdmin>
                  <Usuarios />
                </SomenteAdmin>
              </Protegido>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
