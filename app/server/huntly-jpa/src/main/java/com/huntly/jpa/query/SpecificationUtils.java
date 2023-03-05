package com.huntly.jpa.query;

import com.huntly.jpa.query.annotation.*;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.ReflectionUtils;
import org.springframework.util.StringUtils;

import javax.persistence.criteria.Predicate;
import java.lang.annotation.Annotation;
import java.lang.reflect.AnnotatedElement;
import java.util.*;
import java.util.stream.Collectors;

public class SpecificationUtils {

    /**
     * 注解查询入口方法，使用注解的方式标记查询
     * @param queryCriteria 查询条件，带注解的对象
     * @param <T> 实体类型
     * @return Specification
     */
    public static <T> Specification<T> fromQueryCriteria(Object queryCriteria) {
        return (root, query, criteriaBuilder) -> {
            //构造方查询的map，key是查询的名字，value 是查询对象
            Map<String, Specification<T>> specifications = new HashMap<>();
            Class<?> type = queryCriteria.getClass();
            // 遍历满足条件的属性
            ReflectionUtils.doWithFields(type, field -> {
                if (!field.isAccessible()) {
                    field.setAccessible(true);
                }
                //获取属性的值
                Object value = ReflectionUtils.getField(field, queryCriteria);
                if (Objects.isNull(value)) {
                    return;
                }
                // 判断属性是否是Keywords注解标记的属性
                if (hasAnnotation(field, Keywords.class)) {

                    //获取Keywords注解对象
                    Keywords[] keywords = field.getAnnotationsByType(Keywords.class);
                    //对象转换为string，like查询只能是spring
                    String keywordsValue = String.valueOf(value);
                    for (Keywords keyword : keywords) {
                        String name = keyword.name();
                        if (StringUtils.isEmpty(name)) {
                            name = field.getName();
                        }
                        //存入查询集合
                        specifications.put(name, queryKeywords(keyword, keywordsValue,name));
                    }
                }
                //创建查询集合
                List<Query> queries = new ArrayList<>();
                //判断是否有Query注解
                if (hasAnnotation(field, Query.class)) {
                    queries.add(AnnotationUtils.findAnnotation(field, Query.class));
                }
                //判断是否有Queries注解，内部存放的就是Query注解
                if (hasAnnotation(field, Queries.class)) {
                    queries.addAll(Arrays.asList(AnnotationUtils.findAnnotation(field, Queries.class).value()));
                }
                for (Query queryAnnotation : queries) {
                    String name = queryAnnotation.name();
                    if (StringUtils.isEmpty(name)) {
                        name = field.getName();
                    }
                    String path = queryAnnotation.path();
                    if (StringUtils.isEmpty(path)) {
                        path = name;
                    }
                    specifications.put(name, query(queryAnnotation, path, value));
                }
            }, field -> hasAnnotation(field, Keywords.class)
                    || hasAnnotation(field, Query.class)
                    || hasAnnotation(field, Queries.class));
            List<QueryGroup> queryGroups = new ArrayList<>();

            //判断class上注解有QueryGroup
            if (hasAnnotation(type, QueryGroup.class)) {
                queryGroups.add(AnnotationUtils.findAnnotation(type, QueryGroup.class));
            }
            if (hasAnnotation(type, QueryGroups.class)) {
                queryGroups.addAll(Arrays.asList(AnnotationUtils.findAnnotation(type, QueryGroups.class).value()));
            }
            Set<String> useKeys = new HashSet<>();
            for (QueryGroup queryGroup : queryGroups) {
                specifications.put(queryGroup.name(), queryGroup(queryGroup, specifications));
                useKeys.addAll(Arrays.asList(queryGroup.targetNames()));
            }
            Set<String> allKeys = new HashSet<>(specifications.keySet());
//            System.out.println("allKeys:" + allKeys);
//            System.out.println("useKeys:" + useKeys);
            Set<Predicate> predicates = allKeys.stream()
                    .filter(key -> !useKeys.contains(key))
                    .map(specifications::get)
                    .map(specification -> specification.toPredicate(root, query, criteriaBuilder))
                    .collect(Collectors.toSet());
            if (hasAnnotation(type, QueryRoot.class)) {
                return type.getAnnotation(QueryRoot.class).value().operation(criteriaBuilder, predicates);
            } else {
                return Operator.AND.operation(criteriaBuilder, predicates);
            }
        };
    }

    /**
     * 把 query 转换为对应的 Specification 查询对象
     * @param query
     * @param path
     * @param value
     * @param <T>
     * @return
     */
    private static <T> Specification<T> query(Query query, String path, Object value) {
        return (root, query1, criteriaBuilder) -> query.type().operation(root, criteriaBuilder, path, value);
    }

    /**
     * 把QueryGroup 注解转换为对应的Specification
     * @param queryGroup 分组查询对象
     * @param specifications 组内的查询对象 Specification
     * @param <T>
     * @return
     */
    private static <T> Specification<T> queryGroup(QueryGroup queryGroup, Map<String, Specification<T>> specifications) {
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();
            for (String name : queryGroup.targetNames()) {
                if (specifications.containsKey(name)) {
                    predicates.add(specifications.get(name).toPredicate(root, query, criteriaBuilder));
                }
            }
            return queryGroup.operator().operation(criteriaBuilder, predicates);
        };
    }

    /**
     * 把 keywords 转换为对象的查询对象
     * @param keywords
     * @param value
     * @param <T>
     * @return
     */
    private static <T> Specification<T> queryKeywords(Keywords keywords, String value,String name) {
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();
            String keywordsValue = keywords.prefix() + value + keywords.suffix();
            for (String path : keywords.value()) {
                predicates.add(criteriaBuilder.like(root.get(StringUtils.isEmpty(path) ? name : path).as(String.class), keywordsValue));
            }
            return keywords.operator().operation(criteriaBuilder, predicates);
        };
    }

    private static boolean hasAnnotation(AnnotatedElement element, Class<? extends Annotation> type) {
        return element.getAnnotation(type) != null;
    }

}
