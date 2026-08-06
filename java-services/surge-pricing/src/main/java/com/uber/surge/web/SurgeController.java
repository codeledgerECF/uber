package com.uber.surge.web;

import com.uber.surge.api.ISurgeCalculator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/surge")
public class SurgeController {
    @Autowired
    private ISurgeCalculator surgeCalculator;

    @GetMapping("/{zoneId}")
    public double getSurge(@PathVariable String zoneId) {
        return surgeCalculator.getMultiplier(zoneId);
    }

    @PostMapping("/calculate")
    public double calculate(@RequestBody SurgeRequest request) {
        return surgeCalculator.calculate(request.getZoneId(),
            request.getDemand(), request.getSupply());
    }
}
