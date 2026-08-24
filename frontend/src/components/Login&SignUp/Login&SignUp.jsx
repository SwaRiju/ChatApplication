import React, { useState, useContext } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Login&SignUp.css";
import Carousel from "./Carousel";
import { AuthContext } from "../ContextAPI/AuthContext";
import { useLocation } from "react-router-dom";
import { FaGear } from "react-icons/fa6";
import { API_ENDPOINTS, AXIOS_CONFIG } from "../../api/ApiConfig.js"

const LoginSignupPage = () => {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    username: "",
  });
  const location = useLocation();
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [showFullLoader, setShowFullLoader] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);


  const inviteToken = new URLSearchParams(location.search).get("invite");

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;

  const isFormValid = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (isLogin) {
      return (
        formData.email.trim() !== "" &&
        formData.password.trim() !== "" &&
        emailRegex.test(formData.email) &&
        passwordRegex.test(formData.password)
      );
    } else {
      return (
        formData.username.trim() !== "" &&
        formData.email.trim() !== "" &&
        formData.password.trim() !== "" &&
        formData.confirmPassword.trim() !== "" &&
        emailRegex.test(formData.email) &&
        passwordRegex.test(formData.password) &&
        formData.password === formData.confirmPassword
      );
    }
  };

  const validateForm = (formData, isLogin) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (isLogin) {
      if (!formData.email.trim() || !formData.password.trim()) {
        return { isValid: false, message: "All fields are required" };
      }
      if (!emailRegex.test(formData.email)) {
        return { isValid: false, message: "Invalid email format" };
      }
      if (!passwordRegex.test(formData.password)) {
        return {
          isValid: false,
          message: "Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character",
        };
      }
      return { isValid: true };
    } else {
      if (
        !formData.username.trim() ||
        !formData.email.trim() ||
        !formData.password.trim() ||
        !formData.confirmPassword.trim()
      ) {
        return { isValid: false, message: "All fields are required" };
      }
      if (!emailRegex.test(formData.email)) {
        return { isValid: false, message: "Invalid email format" };
      }
      if (!passwordRegex.test(formData.password)) {
        return {
          isValid: false,
          message:
            "Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character",
        };
      }
      if (formData.password !== formData.confirmPassword) {
        return { isValid: false, message: "Passwords do not match" };
      }
      return { isValid: true };
    }
  };

  React.useEffect(() => {
    if (inviteToken) {
      setIsLogin(false);
    }
  }, [inviteToken]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;

    const validation = validateForm(formData, isLogin);

    if (!validation.isValid) {
      toast.error(`${validation.message}`, { autoClose: 2500 });
      return;
    }

    setIsSubmitting(true);

    try {
      if (isLogin) {
        // 🔹 LOGIN API CALL
        const response = await axios.post(API_ENDPOINTS.AUTH.LOGIN, {
          email: formData.email,
          password: formData.password,
        }, AXIOS_CONFIG);

        const { id, username, email, profilePicture, status } = response.data;

        login({ id, username, email, profilePicture, status });
        toast.success("Login successful!", { autoClose: 1500 });
        setFormData({ email: "", password: "" });
        setTimeout(() => navigate("/"), 1800);
      } else {
        try {
          setShowFullLoader(true);
          await sendSignupOtp(true);
          setShowOtpModal(true);

        } catch (error) {
          console.error("Signup error:", error);
          if (error.response) {
            // Show backend error message
            const errorMessage =
              error.response.data || "Signup failed. Please try again.";
            toast.error(`${errorMessage}`, { autoClose: 2500 });
          } else {
            toast.error("Something went wrong during signup.", {
              autoClose: 2500,
            });
          }
        } finally {
          setShowFullLoader(false);
        }
      }
    } catch (error) {
      console.error("Auth error:", error);

      if (error.response) {
        const errorMessage =
          error.response.data?.message ||
          error.response.data ||
          "Invalid credentials";
        toast.error(`${errorMessage}`, { autoClose: 2500 });
      } else if (error.request) {
        // No response (server might be down)
        toast.error("Server not responding. Please try again later.", {
          autoClose: 2500,
        });
      } else {
        // Unexpected error
        toast.error("Something went wrong.", { autoClose: 2500 });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const sendSignupOtp = async (isFirstSend = false) => {

    if (!isFirstSend && (sendingOtp || otpTimer > 0)) return;

    try {
      setSendingOtp(true);

      await axios.post(API_ENDPOINTS.AUTH.REGISTER_OTP, {
        email: formData.email,
      });

      toast.success("Email Verification OTP Sent!");
      setOtpTimer(60);
      return true;
    } catch (err) {
      toast.error(err.response?.data || "Failed to send OTP");
      throw err;
    } finally {
      setSendingOtp(false);
    }
  };

  React.useEffect(() => {
    if (otpTimer <= 0) return;

    const t = setInterval(() => {
      setOtpTimer((p) => p - 1);
    }, 1000);

    return () => clearInterval(t);
  }, [otpTimer]);


  const verifyOtpAndRegister = async () => {
    if (!/^\d{6}$/.test(otp)) {
      toast.error("Enter valid 6-digit OTP");
      return;
    }


    try {
      setVerifyingOtp(true);

      const otpResponse = await axios.post(API_ENDPOINTS.AUTH.REGISTER_VERIFY_OTP, {
        email: formData.email,
        otp: otp,
      });

      const emailJwt = otpResponse.data;


      // ✅ OTP verified — now register
      const res = await axios.post(API_ENDPOINTS.AUTH.REGISTER,
        {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          inviteToken: inviteToken || null,
        },
        {
          headers: {
            Authorization: `Bearer ${emailJwt}`,
          },
        }
      );

      toast.success("Signup successful! Please login.");
      setShowOtpModal(false);
      setIsLogin(true);
      setFormData({ email: "", password: "", confirmPassword: "", username: "" });
      setOtp("");
    } catch (err) {
      toast.error(err.response?.data || "OTP verification failed");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleOutsideClick = (e) => {
    if (e.target === e.currentTarget) {
      setOtp("");
      setShowOtpModal(false);
    }
  };


  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSubmit(e);
    }
  };

  const handleGoogleSignIn = () => {
    alert("Google sign in would be implemented here");
  };

  const handleFacebookSignIn = () => {
    alert("Facebook sign in would be implemented here");
  };

  return (
    <>
      <div className="login-signup-container" onKeyDown={handleKeyDown}>
        {/* Left Side - Carousel */}
        <div className="left-side">
          <Carousel />
        </div>
        {/* Right Side - Login/Signup Form */}
        <div className="right-side">
          <div className="form-side">
            <div className="form-container">
              <div className="form-card">
                <h1 className="form-title">{isLogin ? "Login" : "Sign Up"}</h1>

                <p className="form-subtitle">
                  {isLogin ? (
                    <>
                      New to chatting app?{" "}
                      <button
                        onClick={() => setIsLogin(false)}
                        className="toggle-link"
                      >
                        Signup Now
                      </button>
                    </>
                  ) : (
                    <>
                      Already have an account?{" "}
                      <button
                        onClick={() => setIsLogin(true)}
                        className="toggle-link"
                      >
                        Login Now
                      </button>
                    </>
                  )}
                </p>

                <div className="form-fields">
                  {/* Full Name (only for signup) */}
                  {!isLogin && (
                    <div className="input-group">
                      <input
                        type="text"
                        name="username"
                        placeholder="Username"
                        value={formData.username}
                        onChange={handleInputChange}
                        className="form-input"
                        required
                      />
                    </div>
                  )}

                  {/* Email */}
                  <div className="input-group">
                    <input
                      type="email"
                      name="email"
                      placeholder="Email Id"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="form-input"
                      required
                    />
                  </div>

                  {/* Password */}
                  <div className="input-group">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="form-input password-input"
                      minLength={8}
                      pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="password-toggle"
                    >
                      {showPassword ? (
                        <FaEyeSlash size={20} />
                      ) : (
                        <FaEye size={20} />
                      )}
                    </button>
                  </div>

                  {!isLogin && formData.password && !passwordRegex.test(formData.password) && (
                    <small className="password-hint" style={{color: "White"}}>
                      Password must be at least 8 characters and include uppercase,
                      lowercase, number and special character.
                    </small>
                  )}

                  {/* Confirm Password (only for signup) */}
                  {!isLogin && (
                    <div className="input-group">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        placeholder="Confirm Password"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className="form-input password-input"
                        required
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                        className="password-toggle"
                      >
                        {showConfirmPassword ? (
                          <FaEyeSlash size={20} />
                        ) : (
                          <FaEye size={20} />
                        )}
                      </button>
                    </div>
                  )}

                  {!isLogin && formData.confirmPassword &&
                    formData.password !== formData.confirmPassword && (
                      <small className="password-hint" style={{color: "White"}}>
                        Passwords do not match.
                      </small>
                    )}

                  {/* Submit Button */}
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="submit-btn"
                    disabled={!isFormValid() || isSubmitting}
                    style={{
                      opacity: !isFormValid() ? 0.5 : 1,
                      cursor: !isFormValid() ? "not-allowed" : "pointer",
                    }}
                  >
                    {isSubmitting
                      ? isLogin
                        ? "Logging You in..."
                        : "Creating Your Account..."
                      : isLogin
                        ? "Login"
                        : "Sign Up"}
                  </button>
                  {isLogin && (
                    <div className="forgot-password-container">
                      <button
                        type="button"
                        className="forgot-password-link"
                        onClick={() => navigate("/forgot-password")}
                      >
                        Forgot Password?
                      </button>
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="divider">
                  <div className="divider-line"></div>
                  <span className="divider-text">Or</span>
                  <div className="divider-line"></div>
                </div>

                {/* Social Login Buttons */}
                <div className="social-buttons">
                  <button
                    onClick={handleGoogleSignIn}
                    className="social-btn google-btn"
                  >
                    <svg className="social-icon" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span>Sign {isLogin ? "in" : "up"} with Google</span>
                  </button>

                  <button
                    onClick={handleFacebookSignIn}
                    className="social-btn facebook-btn"
                  >
                    <svg
                      className="social-icon"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    <span>Sign {isLogin ? "in" : "up"} with Facebook</span>
                  </button>
                </div>

                {/* Terms and Conditions */}
                <p className="terms-text">
                  By signing {isLogin ? "in" : "up"}, I agree to the{" "}
                  <button className="terms-link">Terms and Conditions</button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showOtpModal && (
        <div className="otp-modal-overlay" onClick={handleOutsideClick}>
          <div className="otp-modal">
            <h2>Verify Your Account</h2>
            <p>
              We sent a verification code to <br />
              <span className="otp-email">{formData.email}</span>
            </p>

            <div className="otp-box-container">
              {[...Array(6)].map((_, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  className="otp-box"
                  maxLength="1"
                  inputMode="numeric" // Better for mobile keyboards
                  value={otp[index] || ""}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    if (!val) return; // Handle empty via onKeyDown

                    const newOtpArray = otp.split("");
                    newOtpArray[index] = val.at(-1); // Take the last character typed
                    const finalOtp = newOtpArray.join("");
                    setOtp(finalOtp);

                    // Auto-focus next
                    if (val && index < 5) {
                      document.getElementById(`otp-${index + 1}`).focus();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace") {
                      if (!otp[index] && index > 0) {
                        // Case 1: Box is already empty, move to previous and clear it
                        const newOtpArray = otp.split("");
                        newOtpArray[index - 1] = "";
                        setOtp(newOtpArray.join(""));
                        document.getElementById(`otp-${index - 1}`).focus();
                      } else {
                        // Case 2: Box has a value, just clear it
                        const newOtpArray = otp.split("");
                        newOtpArray[index] = "";
                        setOtp(newOtpArray.join(""));
                      }
                    }
                  }}
                  onPaste={(e) => {
                    // PRO TIP: Handle pasting the whole code at once
                    const pasteData = e.clipboardData.getData("text").slice(0, 6);
                    if (/^\d+$/.test(pasteData)) {
                      setOtp(pasteData);
                      document.getElementById(`otp-${pasteData.length - 1}`).focus();
                    }
                  }}
                />
              ))}
            </div>

            <div className="otp-timer">
              {otpTimer > 0 ? (
                <span className="timer-text">Resend code in <b>{otpTimer}s</b></span>
              ) : (
                <div className="resend-wrapper">
                  Didn't receive the code?
                  <button className="resend-btn" onClick={sendSignupOtp}>Resend</button>
                </div>
              )}
            </div>

            <button
              className="verify-btn"
              onClick={verifyOtpAndRegister}
              disabled={verifyingOtp || otp.length < 6}
            >
              {verifyingOtp ? "Verifying..." : "Verify"}
            </button>

            <button className="cancel-btn" onClick={() => { setOtp(""); setShowOtpModal(false) }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {showFullLoader && (
        <div className="fullscreen-loader">
          <div className="loader-content">
            <div className="gear-system">
              <div className="gear-outer"></div>
              <div className="gear-inner"></div>
              <div className="gear-core"></div>
            </div>
            <div className="text-container">
              <p>Generating Verification Code</p>
              <div className="loading-dots"></div>
            </div>
          </div>
        </div>
      )}


      <ToastContainer position="top-right" autoClose={2000} theme="light" />
    </>
  );
};

export default LoginSignupPage;
