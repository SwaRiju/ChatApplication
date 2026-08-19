import React, { useState, useEffect } from "react";
import "./ForgotPassword.css";
import { toast, ToastContainer } from "react-toastify";
import axios from "axios";
import { useNavigate } from 'react-router-dom';
import { API_ENDPOINTS } from "../../api/ApiConfig";

export default function ForgotPassword() {
  const [formData, setFormData] = useState({
    email: "",
    otp: "",
    newPassword: "",
    confirmNewPass: "",
  });
  const [otpSent, setOtpSent] = useState(false);
  const [otpArr, setOtpArr] = useState(["", "", "", "", "", ""]);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [otpExpiryTimer, setOtpExpiryTimer] = useState(0);
  const navigate = useNavigate();

  const handleOtpChange = (value, index) => {
    if (!/^\d?$/.test(value)) return;

    const newOtp = [...otpArr];
    newOtp[index] = value;
    setOtpArr(newOtp);

    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`).focus();
    }
  };

  const handleOtpKeyDown = (e, index) => {
    if (e.key === "Backspace" && !otpArr[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`).focus();
    }
  };

  const fullOtp = otpArr.join("");


  const isFormValid = (e) => {
    if (
      formData.email.trim() !== "" &&
      formData.otp.trim() !== "" &&
      formData.newPassword.trim() !== "" &&
      formData.confirmNewPass.trim() !== ""
    ) {
      return true;
    } else return false;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // limit OTP to 6 digits
    if (name === "otp" && value.length > 6) return;

    setFormData({ ...formData, [name]: value });
  };

  useEffect(() => {
    if (resendTimer <= 0) return;

    const i = setInterval(() => {
      setResendTimer((t) => t - 1);
    }, 1000);

    return () => clearInterval(i);
  }, [resendTimer]);

  useEffect(() => {
    if (otpExpiryTimer <= 0) return;

    const i = setInterval(() => {
      setOtpExpiryTimer((t) => t - 1);
    }, 1000);

    return () => clearInterval(i);
  }, [otpExpiryTimer]);


  const handleSendOtp = async (e) => {
    e.preventDefault();

    if (!formData.email.trim()) {
      toast.error("Email is required");
      return;
    }

    if (sendingOtp || resendTimer > 0) return;

    try {
      setSendingOtp(true);

      const response = await axios.post(
        API_ENDPOINTS.FORGOT_PASSWORD.GET_OTP,
        { email: formData.email }
      );
      toast.success("📨 OTP sent successfully to your email!");
      console.log("OTP Response:", response.data);
      setOtpSent(true);
      setResendTimer(60);
      setOtpExpiryTimer(300);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send OTP");
      console.error("Error sending OTP:", error);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!/^\d{6}$/.test(fullOtp)) {
      toast.error("OTP must be exactly 6 digits");
      return;
    }
    if (!formData.newPassword || !formData.confirmNewPass) {
      toast.error("Please fill out all password fields");
      return;
    }

    if (formData.newPassword !== formData.confirmNewPass) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      const response = await axios.patch(
        API_ENDPOINTS.FORGOT_PASSWORD.CHANGE_PASSWORD,
        {
          email: formData.email,
          otp: fullOtp,
          newPassword: formData.newPassword,
          confirmNewPass: formData.confirmNewPass,
        }
      );
      toast.success("Password Changed Successfully!");
      console.log("Change Password Response:", response.data);
      setOtpSent(false);
      setFormData({ email: "", otp: "", newPassword: "", confirmNewPass: "" });
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to change password");
      console.error("Error changing password:", error);
    }
  };

  useEffect(() => {
    if (otpExpiryTimer === 0 && otpSent) {
      setOtpArr(["", "", "", "", "", ""]);
      toast.error("OTP expired. Please resend.");
    }
  }, [otpExpiryTimer, otpSent]);


  return (
    <>
      <div className="Forgot-pass-main">
        <div className="forgot-form">
          <h2>Forgot Password</h2>
          <form className="forgot" onSubmit={handleSubmit}>
            <div className="email-otp">
              <input
                type="email"
                name="email"
                placeholder="Enter Your Email"
                value={formData.email}
                onChange={handleChange}
                disabled={otpSent}
                required
              />
              <button
                type="button"
                className="get-otp"
                onClick={handleSendOtp}
                disabled={sendingOtp || resendTimer > 0}
              >
                {sendingOtp ? (
                  <span className="spinner"></span>
                ) : resendTimer > 0 ? (
                  `Resend in ${resendTimer}s`
                ) : otpSent ? (
                  "Resend OTP"
                ) : (
                  "Send OTP"
                )}
              </button>
            </div>

            {otpSent && (
              <>
              <div className="otp-main">
                <div className="otp-box-container">
                  {otpArr.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-${i}`}
                      className="otp-box"
                      type="text"
                      inputMode="numeric"
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handleOtpChange(e.target.value, i)}
                      onKeyDown={(e) => handleOtpKeyDown(e, i)}
                    />
                  ))}
                </div>

                <p className="otp-timer">
                  {otpExpiryTimer > 0
                    ? `OTP expires in ${Math.floor(otpExpiryTimer / 60)}:${String(
                      otpExpiryTimer % 60
                    ).padStart(2, "0")}`
                    : "OTP expired"}
                </p>
              </div>

                <input
                  type="password"
                  name="newPassword"
                  placeholder="Enter new password"
                  value={formData.newPassword}
                  onChange={handleChange}
                  required
                />
                <input
                  type="password"
                  name="confirmNewPass"
                  placeholder="Confirm new password"
                  value={formData.confirmNewPass}
                  onChange={handleChange}
                  required
                />
                <button className="change-pass" disabled={!isFormValid()}>
                  Change Password
                </button>
              </>
            )}
          </form>
        </div>
        <ToastContainer position="top-right" autoClose={2000} theme="light" />
      </div>
    </>
  );
}
