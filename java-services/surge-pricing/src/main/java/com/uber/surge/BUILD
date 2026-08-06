java_library(
    name = "surge_pricing",
    srcs = glob(["*.java"]),
    deps = [
        "//java-services/common/src/main/java/com/uber/common:common",
        "@maven//:org_springframework_spring_web",
        "@maven//:org_springframework_kafka_spring_kafka",
        "@maven//:org_springframework_boot_spring_boot_autoconfigure",
    ],
    visibility = ["//visibility:public"],
)

java_test(
    name = "surge_pricing_test",
    srcs = glob(["*Test.java"]),
    deps = [
        ":surge_pricing",
        "@maven//:junit_junit",
        "@maven//:org_mockito_mockito_core",
    ],
)
