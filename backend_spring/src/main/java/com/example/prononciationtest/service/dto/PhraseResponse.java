package com.example.prononciationtest.service.dto;

import lombok.AllArgsConstructor;
import lombok.Data;


public class PhraseResponse {
    private String phrase;

    public PhraseResponse() {}
    public PhraseResponse(String phrase) { this.phrase = phrase; }

    public String getPhrase() { return phrase; }
    public void setPhrase(String phrase) { this.phrase = phrase; }
}