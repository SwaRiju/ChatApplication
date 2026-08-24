package com.example.chat.Service;

import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class BrevoEmailService {

    private final RestClient restClient;

    @Value("${brevo.api-key}")
    private String apiKey;

    @Value("${brevo.sender-email}")
    private String senderEmail;

    @Value("${brevo.sender-name}")
    private String senderName;

    public BrevoEmailService() {
        this.restClient = RestClient.builder()
                .baseUrl("https://api.brevo.com/v3")
                .build();
    }

    public void sendEmail(String recipient, String subject, String text) {

        Map<String, Object> requestBody = Map.of(
                "sender", Map.of(
                        "name", senderName,
                        "email", senderEmail
                ),
                "to", new Object[]{
                        Map.of(
                                "email", recipient
                        )
                },
                "subject", subject,
                "textContent", text
        );

        restClient.post()
                .uri("/smtp/email")
                .header("api-key", apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody)
                .retrieve()
                .toBodilessEntity();
    }
}