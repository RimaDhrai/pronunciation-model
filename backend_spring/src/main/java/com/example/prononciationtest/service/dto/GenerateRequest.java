package com.example.prononciationtest.service.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

// Body JSON pour POST /api/practice/generate
// { "lang": "fr", "level": "B1" }
public class GenerateRequest {

    @NotBlank(message = "La langue est requise (fr ou en)")
    @Pattern(regexp = "^(fr|en)$", message = "La langue doit être 'fr' ou 'en'")
    private String lang;

    @NotBlank(message = "Le niveau CECRL est requis")
    @Pattern(regexp = "^(A1|A2|B1|B2|C1|C2)$", message = "Le niveau doit être A1, A2, B1, B2, C1 ou C2")
    private String level;

    public GenerateRequest() {}
    public GenerateRequest(String lang, String level) {
        this.lang = lang;
        this.level = level;
    }

    public String getLang()  { return lang; }
    public void setLang(String lang)   { this.lang = lang; }
    public String getLevel() { return level; }
    public void setLevel(String level) { this.level = level; }
}