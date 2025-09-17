// Navbar.js
import { useParams, useNavigate, Navigate } from "react-router-dom";
import React, { useState,useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Navbar as MaterialNavbar,
  MobileNav,
  Typography,
  Button,
  IconButton,
  Menu,
  MenuHandler,
  MenuList,
  MenuItem,
  Avatar,
} from "@material-tailwind/react";
import { useAuth } from "./context/AuthContext";

function Navbar() {
  const [openNav, setOpenNav] = useState(false);
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  
  useEffect(() => {
    window.addEventListener(
      "resize",
      () => window.innerWidth >= 960 && setOpenNav(false)
    );
  }, []);

    function handleLogin(){
      navigate("/login");
    }

    function handleLogout(){
      logout();
      navigate("/");
    }

    const navList = (
    <ul className="mb-4 mt-2 flex flex-col gap-2 lg:mb-0 lg:mt-0 lg:flex-row lg:items-center lg:gap-6">
      <Typography
        as="li"
        variant="small"
        color="blue-gray"
        className="p-1 font-normal"
      >
        <Link to="/about" className="flex items-center">
          About
        </Link>
      </Typography>
      <Typography
        as="li"
        variant="small"
        color="blue-gray"
        className="p-1 font-normal"
      >
        <Link to="/" className="flex items-center">
          Services
        </Link>
      </Typography>
      <Typography
        as="li"
        variant="small"
        color="blue-gray"
        className="p-1 font-normal"
      >
        <Link to="/faq" className="flex items-center">
          FAQ's
        </Link>
      </Typography>
      {isAuthenticated && (
        <>
          <Typography
            as="li"
            variant="small"
            color="blue-gray"
            className="p-1 font-normal"
          >
            <Link to="/dashboard" className="flex items-center">
              Dashboard
            </Link>
          </Typography>
          <Typography
            as="li"
            variant="small"
            color="blue-gray"
            className="p-1 font-normal"
          >
            <Link to="/documents" className="flex items-center">
              Documents
            </Link>
          </Typography>
          <Typography
            as="li"
            variant="small"
            color="blue-gray"
            className="p-1 font-normal"
          >
            <Link to="/deadlines" className="flex items-center">
              Deadlines
            </Link>
          </Typography>
        </>
      )}
      </ul>
  );

  return (
    
    <MaterialNavbar className="fixed z-40 top-[-40px] w-full h-16 max-w-full rounded-none py-1 px-4 lg:px-8 lg:py-2 mt-10">
     <div className="flex items-center justify-between text-blue-gray-900">
          {/* <Typography
            as="a"
            href="/"
            className="mr-4 cursor-pointer py-1.5 font-bold text-2xl  font-serif "
          >
            DocBuddy
          </Typography> */}
          <Link to="/" className="mr-4 cursor-pointer py-1.5 font-bold text-2xl  font-serif">
            <img src='https://res.cloudinary.com/dyxnmjtrg/image/upload/v1695064580/copy-img_gd3jcp.png' style={{width:'200px',height:'50px',marginLeft:'-30px'}}/>
          </Link>
          <div className="flex items-center gap-4">
            <div className="mr-4 hidden lg:block">
             
              {navList}</div>
            {!isAuthenticated ? (
              <Button
                onClick={handleLogin}
                variant="gradient"
                size="sm"
                className="hidden lg:inline-block"
              >
                <span>Login</span>
              </Button>
            ) : (
              <Menu>
                <MenuHandler>
                  <Avatar
                    src="https://docs.material-tailwind.com/img/face-2.jpg"
                    alt="avatar"
                    size="sm"
                    className="cursor-pointer"
                  />
                </MenuHandler>
                <MenuList>
                  <MenuItem onClick={() => navigate('/profile')}>
                    Profile
                  </MenuItem>
                  <MenuItem onClick={() => navigate('/notifications')}>
                    Notifications
                  </MenuItem>
                  <MenuItem onClick={handleLogout}>
                    Logout
                  </MenuItem>
                </MenuList>
              </Menu>
            )}
            <IconButton
              variant="text"
              className="ml-auto h-6 w-6 text-inherit hover:bg-transparent focus:bg-transparent active:bg-transparent lg:hidden"
              ripple={false}
              onClick={() => setOpenNav(!openNav)}
            >
              {openNav ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  className="h-6 w-6"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </IconButton>
          </div>
        </div>
        <MobileNav open={openNav} style={{
  backgroundColor: 'rgba(255, 255, 255, 0.95)', // Decreased opacity to 0.25
  boxShadow: '0 0 10px 1px rgba(0, 0, 0, 0.25)',
  backdropFilter: 'blur(15px)'}}>
          {navList}
          <Button variant="gradient" size="sm" fullWidth className="mb-2">
            <span>Buy Now</span>
          </Button>
        </MobileNav>
    </MaterialNavbar>
  );
}

export default Navbar;
