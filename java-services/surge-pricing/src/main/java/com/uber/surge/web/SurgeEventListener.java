package com.uber.surge.web;

import com.uber.surge.api.ISurgeCalculator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class SurgeEventListener {
    @Autowired
    private ISurgeCalculator surgeCalculator;

    @KafkaListener(topics = "demand-updates")
    public void onDemandUpdate(DemandEvent event) {
        surgeCalculator.updateModel(event.getZoneId(), event.getFeatureVector());
    }
}
