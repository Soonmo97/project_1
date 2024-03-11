const { Op } = require("sequelize");
// const { session }  = require("../session");
const { User, Restaurant, Review, Category } = require("../models");
const bcrypt = require("bcrypt");
const { render } = require("ejs");
const nodemailer = require("nodemailer");
const { smtpTransport } = require("../config/email");
const { response } = require("express");
const { assign } = require("nodemailer/lib/shared");

// GET /index
exports.getMain = async (req, res) => {
    const user = req.session.user;

    const restaurants = await Restaurant.findAll({
        attributes: ["rest_index", "rest_name"],
    });

    const indexReview = await Restaurant.findAll({
        attributes: ["rest_index", "rest_name"],
        include: {
            model: Review,
            attributes: ["review_rating"],
        },
    });

    const categories = await Category.findAll({
        include: [
            {
                model: Restaurant,
                attributes: ["rest_index", "rest_name"],
            },
        ],
    });

    console.log("categories", categories);
    // categories [
    //     Category {
    //       dataValues: {
    //         category_index: 9,
    //         category_name: '한식',
    //         rest_index: 10,
    //         Restaurant: [Restaurant]
    //       },

    console.log("//////////////////////////////////////");
    console.log("indexReview", indexReview);
    console.log("//////////////////////////////////////");
    console.log("restaurants:", restaurants);
    console.log("유저 세션 정보>> ", user);
    if (user) {
        res.render("index", {
            isLogin: true,
            user: user,
            restaurants: restaurants,
            indexReview: indexReview,
            // categories: categories,
        });
    } else {
        res.render("index", {
            isLogin: false,
            restaurants: restaurants,
            indexReview: indexReview,
            // categories: categories,
        });
    }
};

// POST /include/header/form/login
exports.loginHeader = async (req, res) => {
    console.log("세션 정보 >> ", req.session);

    const { id, pw } = req.body;

    try {
        const user = await User.findOne({ where: { id } });
        if (user && (await bcrypt.compare(pw, user.pw))) {
            req.session.user = user.id; // 세션에 유저 정보 저장
            req.session.index = user.user_index; // 세션 인덱스 저장 값
            console.log("세션 연결 완료>>  ", req.session.index);
            res.redirect("/");
        } else {
            // res.render("index", { isLogin: false });
            res.send(`<script>
            alert("아이디 또는 비밀번호가 일치하지 않습니다.");
            window.location.href = "/";
            </script>`);
        }
    } catch (error) {
        console.error(error);
        return res.status(500).send("로그인 오류");
    }
};

// POST /include/header/form/register
exports.registerHeader = async (req, res) => {
    const { id, pw, nickname, email } = req.body;
    console.log("id 전달이 됐나요", id);
    try {
        const hashedPassword = await bcrypt.hash(pw, 10);
        const user = await User.findOne({ where: { id } });

        console.log("회원 정보 >> ", user);
        // 기존 아이디와 가입 아이디를 비교해서 찾는 user가 null 값인 경우,
        // 중복되지 않는다는 뜻이기 때문에 가입 허용
        if (user === null) {
            await User.create({
                id: req.body.id,
                pw: hashedPassword,
                nickname: req.body.nickname,
                email: req.body.email,
            }).then((result) => {
                // console.log("회원가입 완료!!", result.id);
                console.log("회원가입 완료 >>", result.id); //result.id = id
                res.redirect("/");
            });
        } else {
            console.log("중복된 아이디 입니다.");
            res.render("index", { isLogin: false });
        }
    } catch (error) {
        console.error(error);
        res.status(500).send("회원가입 실패");
    }
};

// GET /user/login
exports.getLogin = async (req, res) => {
    res.render("user/login");
};

exports.postLogin = async (req, res) => {
    console.log("세션 정보 >> ", req.session);

    const { id, pw } = req.body;

    try {
        const user = await User.findOne({ where: { id } });
        if (user && (await bcrypt.compare(pw, user.pw))) {
            req.session.user = user.id; // 세션에 유저 정보 저장
            req.session.index = user.user_index; // 세션 인덱스 저장 값

            console.log("세션 연결 완료>>  ", req.session.index);

            res.render("index", { isLogin: true, user: id });
        } else {
            // res.send(`<script>
            // alert("아이디 또는 비밀번호가 일치하지 않습니다.");
            // </script>`);
            res.render("index", { isLogin: false });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).send("로그인 오류");
    }
};

// POST /include/header/form_logout
exports.logoutHeader = async (req, res) => {
    if (req.session.user) {
        req.session.destroy((err) => {
            if (err) {
                res.status(500).send("로그아웃 중 오류 발생");
            } else {
                res.redirect("/");
            }
        });
    } else {
        // 세션에 사용자 정보가 없는 경우
        console.log("이미 세션 만료된 회원입니다.");
        res.redirect("/");
    }
};

// POST /user/idCheckFrom/checkForm
exports.checkId = async (req, res) => {
    const { id } = req.body;

    try {
        const user = await User.findOne({ where: { id: id } });

        if (user) {
            console.log("아이디 사용 불가능 입니다.");
            res.send({ available: false }); // 아이디 사용 불가능을 클라이언트에게 전달합니다.
        } else {
            console.log("아이디 사용 가능 입니다.");
            res.send({ available: true }); // 아이디 사용 가능을 클라이언트에게 전달합니다.
        }
    } catch (error) {
        console.error(error);
        res.status(500).send({ error: "서버 오류" }); // 서버 오류를 클라이언트에게 반환합니다.
    }
};

// GET /user/idCheckForm
exports.checkWindow = async (req, res) => {
    res.render("user/idCheckForm");
};

// POST /form/sendCode
exports.sendCode = async (req, res) => {
    // 인증 코드 생성
    const generateRandomNumber = (min, max) => {
        const randNum = Math.floor(Math.random() * (max - min + 1)) + min;
        console.log("랜덤 숫자 >>> ", randNum);
        return randNum;
    };
    const number = generateRandomNumber(111111, 999999).toString();
    const hashAuth = bcrypt.hashSync(number, 10);
    const { email } = req.body;
    req.session.hashAuth = hashAuth;
    console.log("코드 숫자 >>> ", hashAuth);

    // 메일 형식
    const mailOptions = {
        from: process.env.USER_EMAIL,
        to: email,
        subject: "새싹 노드 이메일 연결용",
        text: "인증번호는" + number + "입니다.",
        html:
            "<div style='font-family: 'Apple SD Gothic Neo', 'sans-serif' !important; width: 540px; height: 600px; border-top: 4px solid #348fe2; margin: 100px auto; padding: 30px 0; box-sizing: border-box;'>" +
            "<h1 style='margin: 0; padding: 0 5px; font-size: 28px; font-weight: 400;'>" +
            "<span style='font-size: 15px; margin: 0 0 10px 3px;'></span><br />" +
            "<span style='color: #348fe2;'>인증번호</span> 안내입니다." +
            "</h1>" +
            "<p style='font-size: 16px; line-height: 26px; margin-top: 50px; padding: 0 5px;'>" +
            "안녕하세요.<br />" +
            "요청하신 인증번호가 생성되었습니다.<br />" +
            "감사합니다." +
            "</p>" +
            "<p style='font-size: 16px; margin: 40px 5px 20px; line-height: 28px;'>" +
            "인증번호: <br />" +
            "<span style='font-size: 24px;'>" +
            number +
            "</span>" +
            "</p>" +
            "<div style='border-top: 1px solid #DDD; padding: 5px;'>" +
            "</div>" +
            "</div>",
    };

    await smtpTransport.sendMail(mailOptions, (err, response) => {
        console.log("response", response);
        if (err) {
            res.send({ ok: false, msg: " 메일 전송에 실패하였습니다. " });
            smtpTransport.close(); //전송종료
        } else {
            res.send({ ok: true, msg: " 메일 전송에 성공하였습니다. " });
            console.log();
            smtpTransport.close(); //전송종료
        }
    });
};
// POST /form/checkCode
exports.checkCode = async (req, res) => {
    const { codeValue } = req.body;
    console.log("쿠키 값 : ", req.session);

    const hashAuth = req.session.hashAuth;

    console.log("입력한 코드 값 :: ", req.body);

    // 클라이언트로부터 받은 코드 값과 이메일로 전송된 인증번호를 비교
    if (bcrypt.compareSync(codeValue, hashAuth)) {
        res.json({ ok: true, msg: "인증번호가 일치합니다." });
    } else {
        res.json({ ok: false, msg: "인증번호가 일치하지 않습니다." });
    }
};

// GET /loadMoreRestaurants
exports.loadMoreRestaurants = async (req, res) => {
    const user = req.session.user;
    const newRestaurants = await Restaurant.findAll({
        attributes: ["rest_index", "rest_name"],
    });

    console.log(newRestaurants);
    if (user) {
        res.render("index", {
            isLogin: true,
            user: user,
            newRestaurants: newRestaurants,
        });
    } else {
        res.render("index", { isLogin: false, newRestaurants: newRestaurants });
    }
};
