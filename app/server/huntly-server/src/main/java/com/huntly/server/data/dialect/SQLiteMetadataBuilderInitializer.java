package com.huntly.server.data.dialect;

import org.hibernate.boot.MetadataBuilder;
import org.hibernate.boot.registry.StandardServiceRegistry;
import org.hibernate.boot.spi.MetadataBuilderInitializer;
import org.hibernate.dialect.Dialect;
import org.hibernate.engine.jdbc.dialect.internal.DialectResolverSet;
import org.hibernate.engine.jdbc.dialect.spi.DialectResolutionInfo;
import org.hibernate.engine.jdbc.dialect.spi.DialectResolver;
import org.jboss.logging.Logger;

public class SQLiteMetadataBuilderInitializer implements MetadataBuilderInitializer {

    private final static Logger logger = Logger.getLogger(SQLiteMetadataBuilderInitializer.class);

    @Override
    public void contribute(MetadataBuilder metadataBuilder, StandardServiceRegistry serviceRegistry) {
        DialectResolver dialectResolver = serviceRegistry.getService(DialectResolver.class);

        if (!(dialectResolver instanceof DialectResolverSet)) {
            logger.warnf("DialectResolver '%s' is not an instance of DialectResolverSet, not registering SQLiteDialect",
                    dialectResolver);
            return;
        }

        ((DialectResolverSet) dialectResolver).addResolver(resolver);
    }

    static private final SQLiteDialect dialect = new SQLiteDialect();

    static private final DialectResolver resolver = new DialectResolver() {

        @Override
        public Dialect resolveDialect(DialectResolutionInfo info) {
            if (info.getDatabaseName().equals("SQLite"))
                return dialect;

            return null;
        }

    };
}
