package com.example.chat.Service;

import java.time.LocalDateTime;
import java.util.Random;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.chat.Model.EmailOtpToken;
import com.example.chat.Model.EmailOtpToken.OtpPurpose;
import com.example.chat.Repository.EmailOtpTokenRepo;
import com.example.chat.Repository.UserRepo;

@Service
public class OtpService {

    @Autowired
    private JavaMailSender mailSender;

    @Autowired
    private UserRepo userRepo;

    @Autowired
    private EmailOtpTokenRepo tokenRepo;

    @Transactional
    public void sendOtp(String email, OtpPurpose purpose) {

        // Flow validation
        if (purpose == OtpPurpose.PASSWORD_RESET &&
                userRepo.findByEmail(email).isEmpty()) {
            throw new RuntimeException("User not found");
        }

        if (purpose == OtpPurpose.SIGNUP &&
                userRepo.findByEmail(email).isPresent()) {
            throw new RuntimeException("Email already registered");
        }

        tokenRepo.deleteByEmailAndPurpose(email, purpose);

        String otp = generateOtp();

        EmailOtpToken token = new EmailOtpToken();
        token.setEmail(email);
        token.setOtp(otp);
        token.setExpiryTime(LocalDateTime.now().plusMinutes(5));
        token.setPurpose(purpose);
        token.setAttempts(0);

        tokenRepo.save(token);

        sendMail(email, otp, purpose);
    }

    @Transactional
    public void verifyOtp(String email, String otp, OtpPurpose purpose) {

        EmailOtpToken token = tokenRepo
                .findByEmailAndPurpose(email, purpose)
                .orElseThrow(() -> new RuntimeException("OTP not found"));

        if (token.getExpiryTime().isBefore(LocalDateTime.now())) {
            throw new RuntimeException("OTP expired");
        }

        if (!token.getOtp().equals(otp)) {
            token.setAttempts(token.getAttempts() + 1);
            tokenRepo.save(token);
            throw new RuntimeException("Invalid OTP");
        }

        tokenRepo.delete(token); // one time use
    }

    private void sendMail(String email, String otp, OtpPurpose purpose) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(email);

        if (purpose == OtpPurpose.SIGNUP) {
            message.setSubject("Verify your email");
            message.setText("Your signup verification OTP: " + otp);
        } else {
            message.setSubject("Reset password OTP");
            message.setText("Your password reset OTP: " + otp);
        }

        message.setFrom("chatapp2400@gmail.com");

        try {
            System.out.println("Attempting to send OTP email...");
            System.out.println("SMTP host: smtp.gmail.com");
            System.out.println("SMTP port: 587");
            System.out.println("Recipient: " + email);

            mailSender.send(message);

            System.out.println("OTP email sent successfully.");

        } catch (Exception e) {
            System.err.println("Failed to send OTP email.");
            e.printStackTrace();
            throw e;
        }
    }

    private String generateOtp() {
        int otpValue = 100000 + new Random().nextInt(900000);
        return String.valueOf(otpValue);
    }
}
