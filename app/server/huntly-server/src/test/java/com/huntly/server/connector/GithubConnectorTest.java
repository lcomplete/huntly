package com.huntly.server.connector;

import com.huntly.server.connector.github.GithubConnector;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

class GithubConnectorTest {

    @Test
    void decodeReadmeContent() {
        String content = "aHRtbDJjYW52YXMKPT09PT09PT09PT0KCltIb21lcGFnZV0oaHR0cHM6Ly9o\n" +
                "dG1sMmNhbnZhcy5oZXJ0emVuLmNvbSkgfCBbRG93bmxvYWRzXShodHRwczov\n" +
                "L2dpdGh1Yi5jb20vbmlrbGFzdmgvaHRtbDJjYW52YXMvcmVsZWFzZXMpIHwg\n" +
                "W1F1ZXN0aW9uc10oaHR0cHM6Ly9naXRodWIuY29tL25pa2xhc3ZoL2h0bWwy\n" +
                "Y2FudmFzL2Rpc2N1c3Npb25zL2NhdGVnb3JpZXMvcS1hKQoKWyFbR2l0dGVy\n" +
                "XShodHRwczovL2JhZGdlcy5naXR0ZXIuaW0vSm9pbiUyMENoYXQuc3ZnKV0o\n" +
                "aHR0cHM6Ly9naXR0ZXIuaW0vbmlrbGFzdmgvaHRtbDJjYW52YXM/dXRtX3Nv\n" +
                "dXJjZT1iYWRnZSZ1dG1fbWVkaXVtPWJhZGdlJnV0bV9jYW1wYWlnbj1wci1i\n" +
                "YWRnZSkgCiFbQ0ldKGh0dHBzOi8vZ2l0aHViLmNvbS9uaWtsYXN2aC9odG1s\n" +
                "MmNhbnZhcy93b3JrZmxvd3MvQ0kvYmFkZ2Uuc3ZnP2JyYW5jaD1tYXN0ZXIp\n" +
                "ClshW05QTSBEb3dubG9hZHNdKGh0dHBzOi8vaW1nLnNoaWVsZHMuaW8vbnBt\n" +
                "L2RtL2h0bWwyY2FudmFzLnN2ZyldKGh0dHBzOi8vd3d3Lm5wbWpzLm9yZy9w\n" +
                "YWNrYWdlL2h0bWwyY2FudmFzKQpbIVtOUE0gVmVyc2lvbl0oaHR0cHM6Ly9p\n" +
                "bWcuc2hpZWxkcy5pby9ucG0vdi9odG1sMmNhbnZhcy5zdmcpXShodHRwczov\n" +
                "L3d3dy5ucG1qcy5vcmcvcGFja2FnZS9odG1sMmNhbnZhcykKCiMjIyMgSmF2\n" +
                "YVNjcmlwdCBIVE1MIHJlbmRlcmVyICMjIyMKCiBUaGUgc2NyaXB0IGFsbG93\n" +
                "cyB5b3UgdG8gdGFrZSAic2NyZWVuc2hvdHMiIG9mIHdlYnBhZ2VzIG9yIHBh\n" +
                "cnRzIG9mIGl0LCBkaXJlY3RseSBvbiB0aGUgdXNlcnMgYnJvd3Nlci4gVGhl\n" +
                "IHNjcmVlbnNob3QgaXMgYmFzZWQgb24gdGhlIERPTSBhbmQgYXMgc3VjaCBt\n" +
                "YXkgbm90IGJlIDEwMCUgYWNjdXJhdGUgdG8gdGhlIHJlYWwgcmVwcmVzZW50\n" +
                "YXRpb24gYXMgaXQgZG9lcyBub3QgbWFrZSBhbiBhY3R1YWwgc2NyZWVuc2hv\n" +
                "dCwgYnV0IGJ1aWxkcyB0aGUgc2NyZWVuc2hvdCBiYXNlZCBvbiB0aGUgaW5m\n" +
                "b3JtYXRpb24gYXZhaWxhYmxlIG9uIHRoZSBwYWdlLgoKCiMjIyBIb3cgZG9l\n" +
                "cyBpdCB3b3JrPyAjIyMKVGhlIHNjcmlwdCByZW5kZXJzIHRoZSBjdXJyZW50\n" +
                "IHBhZ2UgYXMgYSBjYW52YXMgaW1hZ2UsIGJ5IHJlYWRpbmcgdGhlIERPTSBh\n" +
                "bmQgdGhlIGRpZmZlcmVudCBzdHlsZXMgYXBwbGllZCB0byB0aGUgZWxlbWVu\n" +
                "dHMuCgpJdCBkb2VzICoqbm90IHJlcXVpcmUgYW55IHJlbmRlcmluZyBmcm9t\n" +
                "IHRoZSBzZXJ2ZXIqKiwgYXMgdGhlIHdob2xlIGltYWdlIGlzIGNyZWF0ZWQg\n" +
                "b24gdGhlICoqY2xpZW50J3MgYnJvd3NlcioqLiBIb3dldmVyLCBhcyBpdCBp\n" +
                "cyBoZWF2aWx5IGRlcGVuZGVudCBvbiB0aGUgYnJvd3NlciwgdGhpcyBsaWJy\n" +
                "YXJ5IGlzICpub3Qgc3VpdGFibGUqIHRvIGJlIHVzZWQgaW4gbm9kZWpzLgpJ\n" +
                "dCBkb2Vzbid0IG1hZ2ljYWxseSBjaXJjdW12ZW50IGFueSBicm93c2VyIGNv\n" +
                "bnRlbnQgcG9saWN5IHJlc3RyaWN0aW9ucyBlaXRoZXIsIHNvIHJlbmRlcmlu\n" +
                "ZyBjcm9zcy1vcmlnaW4gY29udGVudCB3aWxsIHJlcXVpcmUgYSBbcHJveHld\n" +
                "KGh0dHBzOi8vZ2l0aHViLmNvbS9uaWtsYXN2aC9odG1sMmNhbnZhcy93aWtp\n" +
                "L1Byb3hpZXMpIHRvIGdldCB0aGUgY29udGVudCB0byB0aGUgW3NhbWUgb3Jp\n" +
                "Z2luXShodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1NhbWVfb3JpZ2lu\n" +
                "X3BvbGljeSkuCgpUaGUgc2NyaXB0IGlzIHN0aWxsIGluIGEgKip2ZXJ5IGV4\n" +
                "cGVyaW1lbnRhbCBzdGF0ZSoqLCBzbyBJIGRvbid0IHJlY29tbWVuZCB1c2lu\n" +
                "ZyBpdCBpbiBhIHByb2R1Y3Rpb24gZW52aXJvbm1lbnQgbm9yIHN0YXJ0IGJ1\n" +
                "aWxkaW5nIGFwcGxpY2F0aW9ucyB3aXRoIGl0IHlldCwgYXMgdGhlcmUgd2ls\n" +
                "bCBiZSBzdGlsbCBtYWpvciBjaGFuZ2VzIG1hZGUuCgojIyMgQnJvd3NlciBj\n" +
                "b21wYXRpYmlsaXR5ICMjIwoKVGhlIGxpYnJhcnkgc2hvdWxkIHdvcmsgZmlu\n" +
                "ZSBvbiB0aGUgZm9sbG93aW5nIGJyb3dzZXJzICh3aXRoIGBQcm9taXNlYCBw\n" +
                "b2x5ZmlsbCk6CgoqIEZpcmVmb3ggMy41KwoqIEdvb2dsZSBDaHJvbWUKKiBP\n" +
                "cGVyYSAxMisKKiBJRTkrCiogU2FmYXJpIDYrCgpBcyBlYWNoIENTUyBwcm9w\n" +
                "ZXJ0eSBuZWVkcyB0byBiZSBtYW51YWxseSBidWlsdCB0byBiZSBzdXBwb3J0\n" +
                "ZWQsIHRoZXJlIGFyZSBhIG51bWJlciBvZiBwcm9wZXJ0aWVzIHRoYXQgYXJl\n" +
                "IG5vdCB5ZXQgc3VwcG9ydGVkLgoKIyMjIFVzYWdlICMjIwoKVGhlIGh0bWwy\n" +
                "Y2FudmFzIGxpYnJhcnkgdXRpbGl6ZXMgYFByb21pc2VgcyBhbmQgZXhwZWN0\n" +
                "cyB0aGVtIHRvIGJlIGF2YWlsYWJsZSBpbiB0aGUgZ2xvYmFsIGNvbnRleHQu\n" +
                "IElmIHlvdSB3aXNoIHRvCnN1cHBvcnQgW29sZGVyIGJyb3dzZXJzXShodHRw\n" +
                "Oi8vY2FuaXVzZS5jb20vI3NlYXJjaD1wcm9taXNlKSB0aGF0IGRvIG5vdCBu\n" +
                "YXRpdmVseSBzdXBwb3J0IGBQcm9taXNlYHMsIHBsZWFzZSBpbmNsdWRlIGEg\n" +
                "cG9seWZpbGwgc3VjaCBhcwpbZXM2LXByb21pc2VdKGh0dHBzOi8vZ2l0aHVi\n" +
                "LmNvbS9qYWtlYXJjaGliYWxkL2VzNi1wcm9taXNlKSBiZWZvcmUgaW5jbHVk\n" +
                "aW5nIGBodG1sMmNhbnZhc2AuCgpUbyByZW5kZXIgYW4gYGVsZW1lbnRgIHdp\n" +
                "dGggaHRtbDJjYW52YXMsIHNpbXBseSBjYWxsOgpgIGh0bWwyY2FudmFzKGVs\n" +
                "ZW1lbnRbLCBvcHRpb25zXSk7YAoKVGhlIGZ1bmN0aW9uIHJldHVybnMgYSBb\n" +
                "UHJvbWlzZV0oaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMv\n" +
                "ZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMv\n" +
                "UHJvbWlzZSkgY29udGFpbmluZyB0aGUgYDxjYW52YXM+YCBlbGVtZW50LiBT\n" +
                "aW1wbHkgYWRkIGEgcHJvbWlzZSBmdWxmaWxsbWVudCBoYW5kbGVyIHRvIHRo\n" +
                "ZSBwcm9taXNlIHVzaW5nIGB0aGVuYDoKCiAgICBodG1sMmNhbnZhcyhkb2N1\n" +
                "bWVudC5ib2R5KS50aGVuKGZ1bmN0aW9uKGNhbnZhcykgewogICAgICAgIGRv\n" +
                "Y3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoY2FudmFzKTsKICAgIH0pOwoKIyMj\n" +
                "IEJ1aWxkaW5nICMjIwoKWW91IGNhbiBkb3dubG9hZCByZWFkeSBidWlsZHMg\n" +
                "W2hlcmVdKGh0dHBzOi8vZ2l0aHViLmNvbS9uaWtsYXN2aC9odG1sMmNhbnZh\n" +
                "cy9yZWxlYXNlcykuCgpDbG9uZSBnaXQgcmVwb3NpdG9yeToKCiAgICAkIGdp\n" +
                "dCBjbG9uZSBnaXQ6Ly9naXRodWIuY29tL25pa2xhc3ZoL2h0bWwyY2FudmFz\n" +
                "LmdpdAoKSW5zdGFsbCBkZXBlbmRlbmNpZXM6CgogICAgJCBucG0gaW5zdGFs\n" +
                "bAoKQnVpbGQgYnJvd3NlciBidW5kbGUKCiAgICAkIG5wbSBydW4gYnVpbGQK\n" +
                "CiMjIyBFeGFtcGxlcyAjIyMKCkZvciBtb3JlIGluZm9ybWF0aW9uIGFuZCBl\n" +
                "eGFtcGxlcywgcGxlYXNlIHZpc2l0IHRoZSBbaG9tZXBhZ2VdKGh0dHBzOi8v\n" +
                "aHRtbDJjYW52YXMuaGVydHplbi5jb20pIG9yIHRyeSB0aGUgW3Rlc3QgY29u\n" +
                "c29sZV0oaHR0cHM6Ly9odG1sMmNhbnZhcy5oZXJ0emVuLmNvbS90ZXN0cy8p\n" +
                "LgoKIyMjIENvbnRyaWJ1dGluZyAjIyMKCklmIHlvdSB3aXNoIHRvIGNvbnRy\n" +
                "aWJ1dGUgdG8gdGhlIHByb2plY3QsIHBsZWFzZSBzZW5kIHRoZSBwdWxsIHJl\n" +
                "cXVlc3RzIHRvIHRoZSBkZXZlbG9wIGJyYW5jaC4gQmVmb3JlIHN1Ym1pdHRp\n" +
                "bmcgYW55IGNoYW5nZXMsIHRyeSBhbmQgdGVzdCB0aGF0IHRoZSBjaGFuZ2Vz\n" +
                "IHdvcmsgd2l0aCBhbGwgdGhlIHN1cHBvcnQgYnJvd3NlcnMuIElmIHNvbWUg\n" +
                "Q1NTIHByb3BlcnR5IGlzbid0IHN1cHBvcnRlZCBvciBpcyBpbmNvbXBsZXRl\n" +
                "LCBwbGVhc2UgY3JlYXRlIGFwcHJvcHJpYXRlIHRlc3RzIGZvciBpdCBhcyB3\n" +
                "ZWxsIGJlZm9yZSBzdWJtaXR0aW5nIGFueSBjb2RlIGNoYW5nZXMuCg==";
        String decodedContent = GithubConnector.decodeReadmeContent(content);
        //System.out.println(decodedContent);
        assertThat(decodedContent).isNotBlank();
    }
}