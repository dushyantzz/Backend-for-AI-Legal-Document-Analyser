import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import "./App.css";
import React from "react";
import Home from "./Home";
import Service from "./Service";
import About from "./about";
import Navbar from "./Navbar";
import InputForm from "./InputForm";
import Footer from "./footer";
import Chatbot from "./chatbot";
import Faq from "./Faq";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Login from "./loginPage";
import Signup from "./signup";
import { ContextProvider } from "./context/StepContext";
import { AuthProvider } from "./context/AuthContext";
import Chat from "./components/Chat";
import Dashboard from "./components/Dashboard";
import Profile from "./components/Profile";
import Deadlines from "./components/Deadlines";
import Documents from "./components/Documents";
import Notifications from "./components/Notifications";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <>
      <AuthProvider>
        <ContextProvider>
          <Router>
            <Navbar />
            <Chat />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/service/:id" element={<Service />} />
              <Route path="/form/:id" element={<InputForm />} />
              <Route path="/about" element={<About />} />
              <Route path="/faq" element={<Faq />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
              <Route path="/deadlines" element={<ProtectedRoute><Deadlines /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              {/* <Route path="/chat" element={<Chat />} /> */}
            </Routes>
            <ToastContainer />
          </Router>

          
          <Footer />
        </ContextProvider>
      </AuthProvider>
    </>
  );
}

export default App;
