package com.huntly.server.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;

class HuntlyEnvironmentPostProcessorTest {

    private final HuntlyEnvironmentPostProcessor processor = new HuntlyEnvironmentPostProcessor();

    @Test
    void appendsForwardSlashWhenWindowsPathHasNoTrailingSeparator() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("huntly.dataDir", "C:\\Users\\name\\huntly");

        processor.postProcessEnvironment(env, null);

        assertThat(env.getProperty("huntly.dataDir")).isEqualTo("C:\\Users\\name\\huntly/");
    }

    @Test
    void appendsForwardSlashWhenUnixPathHasNoTrailingSeparator() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("huntly.dataDir", "/var/lib/huntly");

        processor.postProcessEnvironment(env, null);

        assertThat(env.getProperty("huntly.dataDir")).isEqualTo("/var/lib/huntly/");
    }

    @Test
    void leavesPathUntouchedWhenAlreadyEndsWithForwardSlash() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("huntly.dataDir", "/var/lib/huntly/");

        processor.postProcessEnvironment(env, null);

        assertThat(env.getProperty("huntly.dataDir")).isEqualTo("/var/lib/huntly/");
    }

    @Test
    void leavesPathUntouchedWhenAlreadyEndsWithBackslash() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("huntly.dataDir", "C:\\Users\\name\\huntly\\");

        processor.postProcessEnvironment(env, null);

        assertThat(env.getProperty("huntly.dataDir")).isEqualTo("C:\\Users\\name\\huntly\\");
    }

    @Test
    void doesNothingWhenPropertyIsAbsent() {
        MockEnvironment env = new MockEnvironment();

        processor.postProcessEnvironment(env, null);

        assertThat(env.getProperty("huntly.dataDir")).isNull();
    }

    @Test
    void doesNothingWhenPropertyIsEmpty() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("huntly.dataDir", "");

        processor.postProcessEnvironment(env, null);

        assertThat(env.getProperty("huntly.dataDir")).isEmpty();
    }
}
