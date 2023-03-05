package com.huntly.jpa.integration.repository;

import com.huntly.jpa.builder.PersonBuilder;
import com.huntly.jpa.model.PersonInfo;
import com.huntly.jpa.model.Person;
import com.huntly.jpa.model.PersonInfo;
import com.huntly.jpa.repository.PersonRepository;
import com.huntly.jpa.spec.Specifications;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.jpa.domain.Specification;

import java.util.Optional;

import static org.apache.commons.lang3.StringUtils.isNotBlank;
import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
public class RepositoryEqualTest {
    @Autowired
    private PersonRepository personRepository;

    @Test
    public void should_be_able_to_find_projection_interface_by_using_equal() {
        // given
        Person person = new PersonBuilder()
                .name("Jack")
                .age(18)
                .married(true)
                .build();
        personRepository.save(person);

        // when
        Specification<Person> specification = Specifications.<Person>and()
                .eq(isNotBlank(person.getName()), "name", person.getName())
                .eq("married", Boolean.TRUE)
                .build();

        Optional<PersonInfo> result = personRepository.findOne(specification, PersonInfo.class);

        // then
        assertThat(result.get().getName()).isEqualTo(person.getName());
    }

}
