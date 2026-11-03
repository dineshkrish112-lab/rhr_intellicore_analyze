package com.rhr.intellicore.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "plant_profile")
@Getter
@Setter
public class PlantProfile {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String companyName;
    private String plantName;
    private String plantCode;
    private String industry;
    private String address;
    private String city;
    private String state;
    private String country;
    private String pincode;
    private String gstin;
    private String contactEmail;
    private String contactPhone;
    private String plantManager;
    private Integer establishedYear;
    private Integer installedSpindles;
    private Integer workforce;
    private Double powerSanctionedKw;
    private String certifications;
    private String timezone;
}
