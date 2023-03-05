/**
 * Copyright © 2019, Wen Hao <wenhao@126.com>.
 * <p>
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * <p>
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * <p>
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
package com.huntly.jpa.integration.spec;

import com.huntly.jpa.spec.Specifications;
import com.huntly.jpa.builder.PersonBuilder;
import com.huntly.jpa.model.Person;
import com.huntly.jpa.model.Phone;
import com.huntly.jpa.repository.PersonRepository;
import com.huntly.jpa.repository.PhoneRepository;
import org.apache.commons.lang3.StringUtils;
import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.data.jpa.domain.Specification;

import java.util.List;
import java.util.Set;

@DataJpaTest
public class JoinTest {

    @Autowired
    private PersonRepository personRepository;
    @Autowired
    private PhoneRepository phoneRepository;

    @Test
    public void should_be_able_to_find_by_using_many_to_one_query() {
        // given
        Person jack = new PersonBuilder()
                .name("Jack")
                .age(18)
                .phone("iPhone", "139000000000")
                .phone("HuaWei", "13600000000")
                .phone("HuaWei", "18000000000")
                .phone("Samsung", "13600000000")
                .build();

        Set<Phone> jackPhones = jack.getPhones();
        for (Phone phone : jackPhones) {
            phone.setPerson(jack);
        }
        personRepository.save(jack);

        // when
        Specification<Phone> specification = Specifications.<Phone>and()
                .eq("brand", "HuaWei")
                .eq(StringUtils.isNotBlank(jack.getName()), "person.name", jack.getName())
                .build();

        List<Phone> phones = phoneRepository.findAll(specification);

        // then
        assertThat(phones.size()).isEqualTo(2);
    }

    @Test
    public void should_be_able_to_find_by_using_many_to_many_query() {
        // given
        Person jack = new PersonBuilder()
                .name("Jack")
                .age(18)
                .address("Sichuan", 3)
                .address("Sichuan", 5)
                .address("Chengdu", 4)
                .address("Zhonghe", 7)
                .build();

        Person eric = new PersonBuilder()
                .name("Eric")
                .age(20)
                .address("GaoXin", 8)
                .address("Tianfu", 9)
                .address("Chengdu", 4)
                .build();

        Person alex = new PersonBuilder()
                .name("Alex")
                .age(30)
                .address("HuaYang", 1)
                .address("NeiJiang", 2)
                .build();

        personRepository.save(jack);
        personRepository.save(eric);
        personRepository.save(alex);

        // when
        Specification<Person> specification = Specifications.<Person>and()
                .between("age", 10, 35)
                .eq("addresses.street", "Chengdu")
                .build();

        List<Person> phones = personRepository.findAll(specification);

        // then
        assertThat(phones.size()).isEqualTo(2);
    }

}
