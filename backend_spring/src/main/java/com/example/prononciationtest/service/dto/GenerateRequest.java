package com.example.prononciationtest.service.dto;
// ── GenerateRequest ────────────────────────────────────────────────────────
// Body JSON pour POST /api/practice/generate
// { "lang": "fr", "level": "B1" }

public class GenerateRequest {

    private String lang;
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