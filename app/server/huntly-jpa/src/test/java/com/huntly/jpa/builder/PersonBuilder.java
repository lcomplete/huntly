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
package com.huntly.jpa.builder;


import com.huntly.jpa.model.Address;
import com.huntly.jpa.model.IdCard;
import com.huntly.jpa.model.Person;
import com.huntly.jpa.model.Phone;

import java.util.Date;

public class PersonBuilder {
    private Person person;

    public PersonBuilder() {
        this.person = new Person();
    }

    public PersonBuilder name(String name) {
        this.person.setName(name);
        return this;
    }

    public PersonBuilder age(Integer age) {
        this.person.setAge(age);
        return this;
    }

    public PersonBuilder nickName(String nickName) {
        this.person.setNickName(nickName);
        return this;
    }

    public PersonBuilder company(String company) {
        this.person.setCompany(company);
        return this;
    }

    public PersonBuilder birthday(Date birthday) {
        this.person.setBirthday(birthday);
        return this;
    }

    public PersonBuilder phone(String brand, String number) {
        Phone phone = new Phone();
        phone.setBrand(brand);
        phone.setNumber(number);
        this.person.getPhones().add(phone);
        return this;
    }

    public PersonBuilder address(String street, Integer number) {
        Address address = new Address();
        address.setStreet(street);
        address.setNumber(number);
        this.person.getAddresses().add(address);
        return this;
    }

    public PersonBuilder idCard(String number) {
        IdCard idCard = new IdCard();
        idCard.setNumber(number);
        this.person.setIdCard(idCard);
        return this;
    }

    public PersonBuilder married(boolean married) {
        this.person.setMarried(married);
        return this;
    }

    public Person build() {
        return this.person;
    }
}
